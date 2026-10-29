import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react';
import {
  SERVICE_CATEGORIES,
  SERVICES,
  MASTERS,
  ServiceCategory,
} from '../data/studioData';
import {
  fetchAvailableSlots,
  submitBooking,
  ApiTimeSlot,
  ConfirmedBookingDto,
  ApiHttpError,
} from '../api/bookingApi';

interface BookingSectionProps {
  selectedServiceId: string;
  onSelectServiceId: (id: string) => void;
  selectedMasterId: string;
  onSelectMasterId: (id: string) => void;
  selectionBanner: string | null;
  onClearBanner: () => void;
}

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];
const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

function getTodayInMoscowStr(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatHumanDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS_GENITIVE[m - 1] || ''} ${y}`;
}

export const BookingSection: React.FC<BookingSectionProps> = ({
  selectedServiceId,
  onSelectServiceId,
  selectedMasterId,
  onSelectMasterId,
  selectionBanner,
  onClearBanner,
}) => {
  const todayStr = useMemo(() => getTodayInMoscowStr(), []);
  const maxDateStr = useMemo(() => addDaysToDateStr(todayStr, 60), [todayStr]);

  // По умолчанию выбираем завтрашний день, чтобы все утренние и дневные слоты были открыты
  const defaultBookingDate = useMemo(() => addDaysToDateStr(todayStr, 1), [todayStr]);

  // Категория фильтра карточек услуг внутри блока записи
  const [cardCategory, setCardCategory] = useState<ServiceCategory>('all');

  // Состояние календаря и выбранной даты
  const [selectedDate, setSelectedDate] = useState<string>(defaultBookingDate);
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const [y, m] = defaultBookingDate.split('-').map(Number);
    return { year: y, month: m - 1 }; // 0..11
  });

  // Состояние свободных слотов из БД (Cloudflare D1 / SQLite)
  const [slots, setSlots] = useState<ApiTimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Поля формы клиента
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [consentAccepted, setConsentAccepted] = useState<boolean>(false);

  // Ошибки валидации и состояние отправки
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    time?: string;
    consent?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isConflictError, setIsConflictError] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBookingDto | null>(null);

  // Уникальный ключ идемпотентности для текущей попытки бронирования
  const [attemptNonce, setAttemptNonce] = useState<string>(() => crypto.randomUUID());

  const selectedService = useMemo(
    () => SERVICES.find((s) => s.id === selectedServiceId) || SERVICES[0],
    [selectedServiceId]
  );

  const visibleServices = useMemo(
    () =>
      cardCategory === 'all'
        ? SERVICES
        : SERVICES.filter((s) => s.category === cardCategory),
    [cardCategory]
  );

  // Загрузка реально свободных интервалов с сервера
  const loadAvailability = useCallback(async () => {
    if (!selectedDate || !selectedServiceId) return;
    setSlotsLoading(true);
    setSlotsError(null);

    try {
      const response = await fetchAvailableSlots(
        selectedDate,
        selectedServiceId,
        selectedMasterId || 'any'
      );
      setSlots(response.slots);
      // Если ранее выбранное время больше недоступно — сбрасываем его
      setSelectedTime((prevTime) => {
        if (!prevTime) return response.slots[0]?.startTime || '';
        const stillAvailable = response.slots.some((s) => s.startTime === prevTime);
        return stillAvailable ? prevTime : response.slots[0]?.startTime || '';
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Не удалось получить расписание с сервера.';
      setSlotsError(msg);
      setSlots([]);
      setSelectedTime('');
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedDate, selectedServiceId, selectedMasterId]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // При смене параметров записи обновляем ключ идемпотентности
  useEffect(() => {
    setAttemptNonce(crypto.randomUUID());
  }, [selectedServiceId, selectedMasterId, selectedDate, selectedTime, phone]);

  // Построение сетки дней выбранного месяца календаря
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    // День недели первого числа (Пн = 0 ... Вс = 6)
    const jsDay = firstDayOfMonth.getUTCDay();
    const startOffset = jsDay === 0 ? 6 : jsDay - 1;

    const cells: Array<{
      dateStr: string | null;
      dayNumber: number | null;
      isDisabled: boolean;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateStr: null, dayNumber: null, isDisabled: true, isToday: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const isDisabled = dateStr < todayStr || dateStr > maxDateStr;
      cells.push({
        dateStr,
        dayNumber: day,
        isDisabled,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [calendarMonth, todayStr, maxDateStr]);

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  // Клиентская проверка полей перед отправкой на сервер
  const validateClientForm = (): boolean => {
    const errors: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      time?: string;
      consent?: string;
    } = {};

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || trimmedFirst.length < 2) {
      errors.firstName = 'Укажите ваше имя (не менее 2 букв).';
    } else if (!/^[a-zA-Zа-яА-ЯёЁ\s-]+$/.test(trimmedFirst)) {
      errors.firstName = 'Имя может содержать только буквы и дефис.';
    }

    if (!trimmedLast || trimmedLast.length < 2) {
      errors.lastName = 'Укажите вашу фамилию (не менее 2 букв).';
    } else if (!/^[a-zA-Zа-яА-ЯёЁ\s-]+$/.test(trimmedLast)) {
      errors.lastName = 'Фамилия может содержать только буквы и дефис.';
    }

    const digits = phone.replace(/\D/g, '');
    if (!digits || digits.length < 10 || digits.length > 15) {
      errors.phone = 'Введите корректный номер телефона (от 10 до 15 цифр).';
    } else if (/^7?0+$/.test(digits) || /^8?0+$/.test(digits)) {
      errors.phone = 'Пожалуйста, укажите настоящий номер телефона.';
    }

    if (!selectedTime) {
      errors.time = 'Выберите свободный интервал времени.';
    }

    if (!consentAccepted) {
      errors.consent = 'Необходимо подтвердить согласие на обработку персональных данных.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Защита от двойного нажатия

    setSubmitError(null);
    setIsConflictError(false);

    if (!validateClientForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await submitBooking({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        serviceId: selectedServiceId,
        staffId: selectedMasterId || 'any',
        date: selectedDate,
        time: selectedTime,
        consentAccepted,
        idempotencyKey: `web-${attemptNonce}`,
      });

      if (response.booking) {
        setConfirmedBooking(response.booking);
        onClearBanner();
        // Сразу обновляем слоты в фоне, чтобы занятый интервал исчез
        loadAvailability();
      }
    } catch (err) {
      if (err instanceof ApiHttpError && err.status === 409) {
        setIsConflictError(true);
        setSubmitError(
          err.message ||
            'Выбранное время только что было занято. Список доступных интервалов обновлён.'
        );
        await loadAvailability();
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : 'Произошла ошибка при сохранении записи. Попробуйте ещё раз.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSlotObj = useMemo(
    () => slots.find((s) => s.startTime === selectedTime) || null,
    [slots, selectedTime]
  );

  return (
    <section id="booking" className="bg-[#FFFFFF] py-16 sm:py-24">
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
        {/* Заголовок раздела */}
        <div className="mb-10 sm:mb-12">
          <p className="text-xs tracking-[0.12em] text-[#827D76] mb-2">
            ОНЛАЙН-БРОНИРОВАНИЕ · МГНОВЕННОЕ ПОДТВЕРЖДЕНИЕ
          </p>
          <h2 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#292724] leading-[1.15] mb-3">
            Подберём удобное время
          </h2>
          <p className="text-sm sm:text-base text-[#827D76] max-w-[60ch]">
            Выберите процедуру, дату и свободный интервал. Запись сразу фиксируется в расписании студии без ожидания звонка.
          </p>
        </div>

        {selectionBanner && !confirmedBooking && (
          <div
            role="status"
            className="mb-8 px-4 py-3 bg-[#FAF8F5] border border-[#EAE6E1] rounded-[6px] flex items-center justify-between gap-4 text-xs sm:text-sm text-[#292724]"
          >
            <span>{selectionBanner}</span>
            <button
              type="button"
              onClick={onClearBanner}
              className="text-xs text-[#827D76] hover:text-[#292724] whitespace-nowrap cursor-pointer"
            >
              Скрыть
            </button>
          </div>
        )}

        {confirmedBooking ? (
          /* Состояние подтверждённой записи */
          <div
            role="status"
            aria-live="polite"
            className="bg-[#FAF8F5] border border-[#EAE6E1] rounded-[6px] p-6 sm:p-10 max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 text-xs tracking-wide uppercase font-medium text-[#292724] mb-4">
              <span className="w-5 h-5 rounded-full bg-[#E9DED4] flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-[#292724]" aria-hidden="true" />
              </span>
              <span>Запись подтверждена</span>
            </div>

            <h3 className="font-serif-display text-2xl sm:text-3xl text-[#292724] mb-3">
              {confirmedBooking.firstName}, ждём вас в студии LÉA!
            </h3>
            <p className="text-sm sm:text-base text-[#827D76] leading-[1.65] mb-6">
              Выбранный интервал забронирован за вами в базе данных студии. Мы также отправили уведомление администратору.
            </p>

            <dl className="bg-[#FFFFFF] border border-[#EAE6E1] rounded-[6px] p-5 space-y-3 text-sm mb-7">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pb-2.5 border-b border-[#EAE6E1]">
                <dt className="text-[#827D76]">Номер бронирования:</dt>
                <dd className="font-medium text-[#292724] tabular-nums">
                  {confirmedBooking.id}
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-[#827D76]">Гость:</dt>
                <dd className="font-medium text-[#292724]">
                  {confirmedBooking.firstName} {confirmedBooking.lastName}
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-[#827D76]">Телефон:</dt>
                <dd className="text-[#292724] tabular-nums">{confirmedBooking.phone}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-[#827D76]">Услуга:</dt>
                <dd className="font-medium text-[#292724]">
                  {confirmedBooking.serviceTitle} ({confirmedBooking.priceRub.toLocaleString('ru-RU')} ₽ ·{' '}
                  {confirmedBooking.durationMinutes} мин.)
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-[#827D76]">Дата и время:</dt>
                <dd className="font-medium text-[#292724] tabular-nums">
                  {formatHumanDate(confirmedBooking.date)}, {confirmedBooking.startTime}–
                  {confirmedBooking.endTime}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => {
                setConfirmedBooking(null);
                setFirstName('');
                setLastName('');
                setPhone('');
                setConsentAccepted(false);
                setAttemptNonce(crypto.randomUUID());
                loadAvailability();
              }}
              className="px-6 py-3 text-xs sm:text-sm font-medium text-[#FFFFFF] bg-[#292724] hover:bg-[#3d3a36] rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Оформить ещё одну запись
            </button>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} noValidate className="space-y-10">
            {/* ШАГ 1: Выбор услуги в виде карточек */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <span className="text-xs tracking-[0.1em] uppercase text-[#827D76] block mb-1">
                    Шаг 1 из 3
                  </span>
                  <h3 className="font-serif-display text-2xl font-normal text-[#292724]">
                    Выберите услугу
                  </h3>
                </div>

                {/* Фильтр категорий карточек */}
                <div
                  role="tablist"
                  aria-label="Фильтр услуг в форме записи"
                  className="flex flex-wrap items-center gap-1 p-1 bg-[#FAF8F5] border border-[#EAE6E1] rounded-[6px] self-start"
                >
                  {SERVICE_CATEGORIES.map((cat) => {
                    const active = cardCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setCardCategory(cat.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[#FFFFFF] text-[#292724] border border-[#EAE6E1]'
                            : 'text-[#827D76] hover:text-[#292724] border border-transparent'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleServices.map((service) => {
                  const isSelected = service.id === selectedServiceId;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        onSelectServiceId(service.id);
                        setSubmitError(null);
                      }}
                      aria-pressed={isSelected}
                      className={`text-left p-5 rounded-[6px] border transition-colors duration-150 flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#FAF8F5] border-[#292724]'
                          : 'bg-[#FFFFFF] border-[#EAE6E1] hover:bg-[#FAF8F5]/60'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span className="text-[15px] font-medium text-[#292724] leading-snug">
                            {service.title}
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                              isSelected
                                ? 'border-[#292724] bg-[#292724]'
                                : 'border-[#EAE6E1] bg-[#FFFFFF]'
                            }`}
                            aria-hidden="true"
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 text-[#FFFFFF]" />}
                          </span>
                        </div>
                        <p className="text-xs text-[#827D76] leading-[1.55] mb-4">
                          {service.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#EAE6E1] flex items-center justify-between text-xs">
                        <span className="text-[#827D76]">{service.duration}</span>
                        <span className="font-medium text-[#292724] tabular-nums">
                          {service.price}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ШАГ 2: Календарь и выбор реально свободного интервала времени */}
            <div className="pt-8 border-t border-[#EAE6E1]">
              <div className="mb-5">
                <span className="text-xs tracking-[0.1em] uppercase text-[#827D76] block mb-1">
                  Шаг 2 из 3
                </span>
                <h3 className="font-serif-display text-2xl font-normal text-[#292724]">
                  Дата и свободное время
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Календарь */}
                <div className="lg:col-span-5 bg-[#FAF8F5] border border-[#EAE6E1] rounded-[6px] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-[#292724]">
                      {MONTHS_NOMINATIVE[calendarMonth.month]} {calendarMonth.year}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        aria-label="Предыдущий месяц"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-[4px] border border-[#EAE6E1] bg-[#FFFFFF] text-[#292724] hover:bg-[#E9DED4]/50 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        aria-label="Следующий месяц"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-[4px] border border-[#EAE6E1] bg-[#FFFFFF] text-[#292724] hover:bg-[#E9DED4]/50 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Дни недели */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[#827D76] mb-2">
                    {WEEKDAYS_SHORT.map((day) => (
                      <div key={day} className="py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Сетка дат */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((cell, idx) => {
                      if (!cell.dateStr || cell.dayNumber === null) {
                        return <div key={`empty-${idx}`} className="h-9" />;
                      }
                      const isSelected = cell.dateStr === selectedDate;
                      return (
                        <button
                          key={cell.dateStr}
                          type="button"
                          disabled={cell.isDisabled}
                          onClick={() => {
                            setSelectedDate(cell.dateStr!);
                            setFieldErrors((prev) => ({ ...prev, time: undefined }));
                            setSubmitError(null);
                          }}
                          aria-label={`${cell.dayNumber} ${
                            MONTHS_GENITIVE[calendarMonth.month]
                          } ${calendarMonth.year}`}
                          aria-pressed={isSelected}
                          className={`h-9 text-xs rounded-[4px] tabular-nums transition-colors duration-150 flex items-center justify-center ${
                            cell.isDisabled
                              ? 'text-[#827D76]/35 cursor-not-allowed'
                              : isSelected
                              ? 'bg-[#292724] text-[#FFFFFF] font-medium cursor-pointer'
                              : cell.isToday
                              ? 'bg-[#E9DED4]/60 text-[#292724] font-medium hover:bg-[#E9DED4] cursor-pointer'
                              : 'bg-[#FFFFFF] text-[#292724] hover:bg-[#E9DED4]/50 border border-[#EAE6E1]/60 cursor-pointer'
                          }`}
                        >
                          {cell.dayNumber}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#EAE6E1] flex items-center justify-between text-[11px] text-[#827D76]">
                    <span>Временная зона студии: Москва (UTC+3)</span>
                    <span>10:00–21:00</span>
                  </div>
                </div>

                {/* Свободные интервалы времени */}
                <div className="lg:col-span-7 bg-[#FAF8F5] border border-[#EAE6E1] rounded-[6px] p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#827D76] mb-0.5">
                        <CalendarIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Выбрана дата: {formatHumanDate(selectedDate)}</span>
                      </div>
                      <p className="text-sm font-medium text-[#292724]">
                        Доступные интервалы ({selectedService.title}, {selectedService.duration})
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={loadAvailability}
                      disabled={slotsLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#292724] bg-[#FFFFFF] hover:bg-[#E9DED4]/60 border border-[#EAE6E1] rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${slotsLoading ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>Обновить</span>
                    </button>
                  </div>

                  {slotsLoading ? (
                    <div className="py-12 flex items-center justify-center gap-2.5 text-sm text-[#827D76]">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Проверяем свободные интервалы в расписании...</span>
                    </div>
                  ) : slotsError ? (
                    <div
                      role="alert"
                      className="p-4 bg-[#FFFFFF] border border-[#EAE6E1] rounded-[4px] text-xs text-[#8C3B32] flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{slotsError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={loadAvailability}
                        className="px-3 py-1.5 text-xs font-medium text-[#292724] bg-[#FAF8F5] border border-[#EAE6E1] rounded-[4px] whitespace-nowrap cursor-pointer"
                      >
                        Повторить
                      </button>
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="py-10 text-center bg-[#FFFFFF] border border-[#EAE6E1] rounded-[4px] px-4">
                      <p className="text-sm font-medium text-[#292724] mb-1">
                        На выбранную дату нет свободных окон для этой услуги
                      </p>
                      <p className="text-xs text-[#827D76]">
                        Пожалуйста, выберите другую дату в календаре слева.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div
                        role="radiogroup"
                        aria-label="Свободные интервалы времени"
                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5"
                      >
                        {slots.map((slot) => {
                          const isSelected = slot.startTime === selectedTime;
                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => {
                                setSelectedTime(slot.startTime);
                                setFieldErrors((prev) => ({ ...prev, time: undefined }));
                                setSubmitError(null);
                              }}
                              className={`py-2.5 px-3 text-xs rounded-[4px] border tabular-nums transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5 ${
                                isSelected
                                  ? 'bg-[#292724] text-[#FFFFFF] border-[#292724] font-medium'
                                  : 'bg-[#FFFFFF] text-[#292724] border-[#EAE6E1] hover:bg-[#E9DED4]/50'
                              }`}
                            >
                              <Clock className="w-3 h-3 opacity-70" aria-hidden="true" />
                              <span>{slot.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-[11px] text-[#827D76]">
                        Отображаются только реально свободные окна с учётом длительности процедуры ({selectedService.duration}) и перерыва студии (14:30–15:00).
                      </p>
                    </>
                  )}

                  {fieldErrors.time && (
                    <p
                      role="alert"
                      className="mt-3 flex items-center gap-1.5 text-xs text-[#8C3B32]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.time}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ШАГ 3: Контактные данные клиента и подтверждение */}
            <div className="pt-8 border-t border-[#EAE6E1]">
              <div className="mb-5">
                <span className="text-xs tracking-[0.1em] uppercase text-[#827D76] block mb-1">
                  Шаг 3 из 3
                </span>
                <h3 className="font-serif-display text-2xl font-normal text-[#292724]">
                  Ваши контактные данные
                </h3>
              </div>

              <div className="bg-[#FAF8F5] border border-[#EAE6E1] rounded-[6px] p-6 sm:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                  {/* Имя */}
                  <div>
                    <label
                      htmlFor="booking-first-name"
                      className="block text-xs font-medium text-[#292724] mb-1.5"
                    >
                      Имя <span className="text-[#827D76]">*</span>
                    </label>
                    <input
                      id="booking-first-name"
                      name="firstName"
                      type="text"
                      required
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        if (fieldErrors.firstName) {
                          setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                        }
                      }}
                      placeholder="Анна"
                      aria-invalid={Boolean(fieldErrors.firstName)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] text-[#292724] placeholder:text-[#827D76]/60 border border-[#EAE6E1] rounded-[4px] focus:outline-none focus:border-[#292724]"
                    />
                    {fieldErrors.firstName && (
                      <p
                        role="alert"
                        className="mt-1.5 flex items-center gap-1 text-xs text-[#8C3B32]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{fieldErrors.firstName}</span>
                      </p>
                    )}
                  </div>

                  {/* Фамилия */}
                  <div>
                    <label
                      htmlFor="booking-last-name"
                      className="block text-xs font-medium text-[#292724] mb-1.5"
                    >
                      Фамилия <span className="text-[#827D76]">*</span>
                    </label>
                    <input
                      id="booking-last-name"
                      name="lastName"
                      type="text"
                      required
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        if (fieldErrors.lastName) {
                          setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                        }
                      }}
                      placeholder="Смирнова"
                      aria-invalid={Boolean(fieldErrors.lastName)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] text-[#292724] placeholder:text-[#827D76]/60 border border-[#EAE6E1] rounded-[4px] focus:outline-none focus:border-[#292724]"
                    />
                    {fieldErrors.lastName && (
                      <p
                        role="alert"
                        className="mt-1.5 flex items-center gap-1 text-xs text-[#8C3B32]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{fieldErrors.lastName}</span>
                      </p>
                    )}
                  </div>

                  {/* Телефон */}
                  <div>
                    <label
                      htmlFor="booking-phone"
                      className="block text-xs font-medium text-[#292724] mb-1.5"
                    >
                      Номер телефона <span className="text-[#827D76]">*</span>
                    </label>
                    <input
                      id="booking-phone"
                      name="phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (fieldErrors.phone) {
                          setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                        }
                      }}
                      placeholder="+7 900 123-45-67"
                      aria-invalid={Boolean(fieldErrors.phone)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] text-[#292724] placeholder:text-[#827D76]/60 border border-[#EAE6E1] rounded-[4px] focus:outline-none focus:border-[#292724] tabular-nums"
                    />
                    {fieldErrors.phone && (
                      <p
                        role="alert"
                        className="mt-1.5 flex items-center gap-1 text-xs text-[#8C3B32]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{fieldErrors.phone}</span>
                      </p>
                    )}
                  </div>

                  {/* Специалист (необязательно) */}
                  <div>
                    <label
                      htmlFor="booking-master"
                      className="block text-xs font-medium text-[#292724] mb-1.5"
                    >
                      Специалист <span className="text-[#827D76] font-normal">(опционально)</span>
                    </label>
                    <select
                      id="booking-master"
                      name="staffId"
                      value={selectedMasterId}
                      onChange={(e) => onSelectMasterId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] text-[#292724] border border-[#EAE6E1] rounded-[4px] focus:outline-none focus:border-[#292724]"
                    >
                      <option value="">Любой свободный специалист</option>
                      {MASTERS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.role.toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Согласие на обработку персональных данных */}
                <div className="mb-6">
                  <label className="inline-flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(e) => {
                        setConsentAccepted(e.target.checked);
                        if (fieldErrors.consent) {
                          setFieldErrors((prev) => ({ ...prev, consent: undefined }));
                        }
                      }}
                      className="mt-0.5 w-4 h-4 accent-[#292724] rounded-[2px] border border-[#EAE6E1] cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-[#827D76] leading-[1.5]">
                      Я соглашаюсь на обработку персональных данных для оформления записи и получения уведомления о визите в студию LÉA.
                    </span>
                  </label>
                  {fieldErrors.consent && (
                    <p
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8C3B32]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.consent}</span>
                    </p>
                  )}
                </div>

                {/* Ошибка сервера или конфликта слота */}
                {submitError && (
                  <div
                    role="alert"
                    className="mb-6 p-4 bg-[#FFFFFF] border border-[#8C3B32]/40 rounded-[4px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-[#8C3B32]"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{submitError}</span>
                    </div>
                    {isConflictError && (
                      <button
                        type="button"
                        onClick={loadAvailability}
                        className="px-3.5 py-1.5 text-xs font-medium text-[#292724] bg-[#FAF8F5] hover:bg-[#E9DED4] border border-[#EAE6E1] rounded-[4px] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Обновить интервалы
                      </button>
                    )}
                  </div>
                )}

                {/* Итоговая строка и кнопка «Записаться» */}
                <div className="pt-5 border-t border-[#EAE6E1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs sm:text-sm text-[#827D76]">
                    <span>Итого к записи: </span>
                    <span className="font-medium text-[#292724]">
                      {selectedService.title} ({selectedService.price}, {selectedService.duration})
                    </span>
                    {selectedSlotObj && (
                      <>
                        <span> · </span>
                        <span className="font-medium text-[#292724] tabular-nums">
                          {formatHumanDate(selectedDate)}, {selectedSlotObj.label}
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || slotsLoading || !selectedTime}
                    className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-medium text-[#FFFFFF] bg-[#292724] hover:bg-[#3d3a36] disabled:opacity-50 disabled:cursor-not-allowed rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isSubmitting && (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    )}
                    <span>{isSubmitting ? 'Бронируем время...' : 'Записаться'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};
