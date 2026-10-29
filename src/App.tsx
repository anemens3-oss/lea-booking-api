/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import {
  SERVICE_CATEGORIES,
  SERVICES,
  GALLERY_ITEMS,
  MASTERS,
  REVIEWS,
  FAQ_ITEMS,
  ServiceCategory,
  ServiceItem,
  MasterItem,
} from './data/studioData';
import { StudioImage, resolvePublicAssetUrl } from './components/StudioImage';
import { BookingSection } from './components/BookingSection';

export default function App() {
  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Services filter state
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('all');

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // FAQ state
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_ITEMS[0].id);

  // Booking selection state synchronized with BookingSection
  const [selectedServiceId, setSelectedServiceId] = useState<string>(SERVICES[1].id);
  const [selectedMasterId, setSelectedMasterId] = useState<string>('');
  const [selectionBanner, setSelectionBanner] = useState<string | null>(null);

  // Social demo notice state
  const [socialDemoNotice, setSocialDemoNotice] = useState<string | null>(null);

  // Filtered services for the price list section
  const filteredServices =
    activeCategory === 'all'
      ? SERVICES
      : SERVICES.filter((service) => service.category === activeCategory);

  // Smooth scroll helper
  const scrollToSection = useCallback((sectionId: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Select service from price list and scroll to online booking
  const handleSelectService = (service: ServiceItem) => {
    setSelectedServiceId(service.id);
    setSelectionBanner(`Выбрана услуга: «${service.title}» (${service.price}, ${service.duration})`);
    scrollToSection('booking');
  };

  // Select master and scroll to online booking
  const handleSelectMaster = (master: MasterItem) => {
    setSelectedMasterId(master.id);
    const currentService = SERVICES.find((s) => s.id === selectedServiceId);
    if (!currentService || currentService.category !== master.defaultCategory) {
      const matchingService = SERVICES.find((s) => s.category === master.defaultCategory);
      if (matchingService) {
        setSelectedServiceId(matchingService.id);
      }
    }
    setSelectionBanner(`Выбран специалист: ${master.name} (${master.role.toLowerCase()})`);
    scrollToSection('booking');
  };

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % GALLERY_ITEMS.length
        );
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + GALLERY_ITEMS.length) % GALLERY_ITEMS.length
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxIndex]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFFFF] text-[#292724]">
      {/* 2. ШАПКА САЙТА (Strict 3-Zone Top Bar Contract) */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#EAE6E1]">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-serif-display text-2xl sm:text-[28px] font-medium tracking-[0.14em] text-[#292724] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#292724]"
            aria-label="LÉA — Студия красоты, на главную"
          >
            LÉA
          </a>

          {/* Zone 2: 5 clean single-line text navigation links */}
          <nav
            aria-label="Основная навигация"
            className="hidden md:flex items-center gap-7 text-sm font-normal text-[#827D76]"
          >
            <a
              href="#services"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('services');
              }}
              className="hover:text-[#292724] transition-colors duration-150 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#292724]"
            >
              Услуги
            </a>
            <a
              href="#gallery"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('gallery');
              }}
              className="hover:text-[#292724] transition-colors duration-150 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#292724]"
            >
              Наши работы
            </a>
            <a
              href="#masters"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('masters');
              }}
              className="hover:text-[#292724] transition-colors duration-150 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#292724]"
            >
              Мастера
            </a>
            <a
              href="#reviews"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('reviews');
              }}
              className="hover:text-[#292724] transition-colors duration-150 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#292724]"
            >
              Отзывы
            </a>
            <a
              href="#contacts"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('contacts');
              }}
              className="hover:text-[#292724] transition-colors duration-150 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#292724]"
            >
              Контакты
            </a>
          </nav>

          {/* Zone 3: 1 primary action + mobile menu button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => scrollToSection('booking')}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-xs font-medium tracking-wide text-[#292724] bg-[#E9DED4] hover:bg-[#dfd1c4] rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#292724]"
            >
              Записаться
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 text-[#292724] hover:bg-[#FAF8F5] rounded-[4px] transition-colors duration-150 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {mobileMenuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Мобильная навигация"
            className="md:hidden bg-[#FFFFFF] border-b border-[#EAE6E1] px-5 pt-3 pb-6"
          >
            <p className="text-[11px] tracking-[0.14em] text-[#827D76] mb-3">
              СТУДИЯ КРАСОТЫ LÉA
            </p>
            <div className="flex flex-col divide-y divide-[#EAE6E1]">
              {[
                { id: 'services', label: 'Услуги' },
                { id: 'gallery', label: 'Наши работы' },
                { id: 'masters', label: 'Мастера' },
                { id: 'reviews', label: 'Отзывы' },
                { id: 'contacts', label: 'Контакты' },
              ].map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(item.id);
                  }}
                  className="py-3 text-base text-[#292724] hover:text-[#827D76] transition-colors duration-150"
                >
                  {item.label}
                </a>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollToSection('booking')}
              className="mt-4 w-full py-3 px-5 text-sm font-medium text-[#292724] bg-[#E9DED4] hover:bg-[#dfd1c4] rounded-[4px] transition-colors duration-150 cursor-pointer"
            >
              Записаться
            </button>
          </nav>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* 3. ПЕРВЫЙ ЭКРАН (Hero Section) */}
        <section className="bg-[#FFFFFF] pt-8 pb-14 sm:pt-12 sm:pb-20 lg:py-20">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs tracking-[0.12em] text-[#827D76] mb-5">
                  <span>СТУДИЯ КРАСОТЫ</span>
                  <span aria-hidden="true">·</span>
                  <span>ВАШЕ ВРЕМЯ ДЛЯ СЕБЯ</span>
                </div>

                <h1 className="font-serif-display text-[clamp(2.35rem,4.2vw,3.75rem)] leading-[1.08] font-normal text-[#292724] mb-6 max-w-[16ch]">
                  Красота в простых деталях
                </h1>

                <p className="text-base sm:text-[17px] leading-[1.65] text-[#827D76] mb-9 max-w-[48ch]">
                  Маникюр, уход и внимание к мелочам — в спокойной атмосфере, где всё посвящено вам.
                </p>

                <div className="flex flex-wrap items-center gap-5 sm:gap-7">
                  <button
                    type="button"
                    onClick={() => scrollToSection('booking')}
                    className="px-6 py-3.5 text-sm font-medium text-[#FFFFFF] bg-[#292724] hover:bg-[#3d3a36] rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#292724]"
                  >
                    Выбрать услугу
                  </button>

                  <a
                    href="#about"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('about');
                    }}
                    className="inline-flex items-center gap-2 py-2 text-sm font-medium text-[#292724] hover:text-[#827D76] border-b border-[#EAE6E1] hover:border-[#292724] transition-colors duration-150 whitespace-nowrap shrink-0"
                  >
                    <span>Познакомиться со студией</span>
                    <ArrowRight className="w-4 h-4 text-[#827D76]" aria-hidden="true" />
                  </a>
                </div>

                <div className="mt-12 pt-7 border-t border-[#EAE6E1] flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[#827D76]">
                  <span>Камерное светлое пространство</span>
                  <span aria-hidden="true">·</span>
                  <span>Бережные материалы</span>
                  <span aria-hidden="true">·</span>
                  <span>Онлайн-бронирование без ожидания</span>
                </div>
              </div>

              <div className="lg:col-span-6 flex">
                <StudioImage
                  src="/assets/hero-manicure.svg"
                  alt="Ухоженные женские руки с аккуратным маникюром в молочном оттенке на натуральной льняной ткани при мягком дневном свете"
                  className="w-full aspect-[4/3] lg:aspect-auto lg:h-full min-h-[300px] sm:min-h-[420px] rounded-[6px] border border-[#EAE6E1]"
                  imgClassName="hover:scale-[1.015]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 4. КОРОТКИЙ БЛОК О СТУДИИ */}
        <section id="about" className="bg-[#FAF8F5] py-16 sm:py-24 border-y border-[#EAE6E1]">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <div className="lg:col-span-7">
                <p className="text-xs tracking-[0.12em] text-[#827D76] mb-3">
                  О ПРОСТРАНСТВЕ LÉA
                </p>
                <h2 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#292724] leading-[1.15] mb-6 max-w-[24ch]">
                  Ничего лишнего. Только внимание к вам
                </h2>
                <div className="space-y-4 text-[15px] sm:text-base leading-[1.7] text-[#292724]/90 max-w-[62ch]">
                  <p>
                    Мы создали LÉA как светлое и тихое место, где можно замедлиться посреди рабочего дня. Здесь нет громкой музыки, суеты и потока кресел в одном зале — каждое место продумано так, чтобы вам было комфортно и спокойно.
                  </p>
                  <p className="text-[#827D76]">
                    Мастера работают без спешки: перед началом процедуры мы всегда обсуждаем ваши пожелания, подбираем форму, оттенок или уход под особенности кожи и ногтей. Все инструменты проходят полный цикл стерилизации, а одноразовые расходные материалы открываются при вас.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5">
                <figure className="m-0">
                  <StudioImage
                    src="/assets/studio-interior.svg"
                    alt="Детали интерьера студии LÉA: стол из светлого дуба, керамическая ваза с сухоцветами и мягкий утренний свет"
                    className="w-full aspect-[4/3] rounded-[6px] border border-[#EAE6E1]"
                    imgClassName="hover:scale-[1.015]"
                  />
                  <figcaption className="mt-3 text-xs text-[#827D76] flex items-center justify-between">
                    <span>Дневной свет и натуральные текстуры в зале студии</span>
                    <span>Интерьер LÉA</span>
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* 5. УСЛУГИ И ЦЕНЫ */}
        <section id="services" className="bg-[#FFFFFF] py-16 sm:py-24">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h2 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#292724] leading-[1.15] mb-2">
                  Услуги и стоимость
                </h2>
                <p className="text-base text-[#827D76]">
                  Выберите то, что подходит именно вам
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Категории услуг"
                className="flex flex-wrap items-center gap-1.5 p-1 bg-[#FAF8F5] border border-[#EAE6E1] rounded-[6px] self-start"
              >
                {SERVICE_CATEGORIES.map((category) => {
                  const isActive = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveCategory(category.id)}
                      className={`px-3.5 py-2 text-xs sm:text-[13px] font-medium rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-[#FFFFFF] text-[#292724] shadow-[0_1px_2px_rgba(41,39,36,0.06)] border border-[#EAE6E1]'
                          : 'text-[#827D76] hover:text-[#292724] border border-transparent'
                      }`}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[#EAE6E1] divide-y divide-[#EAE6E1]">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF8F5]/60 transition-colors duration-150 px-2 sm:px-4 -mx-2 sm:-mx-4 rounded-[4px]"
                >
                  <div className="max-w-[60ch]">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-1">
                      <h3 className="font-sans text-base sm:text-[17px] font-medium text-[#292724]">
                        {service.title}
                      </h3>
                      <span className="text-xs text-[#827D76]" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-[#827D76]">{service.duration}</span>
                      {activeCategory === 'all' && (
                        <>
                          <span className="text-xs text-[#827D76]" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs text-[#827D76]">{service.categoryLabel}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-[#827D76] leading-[1.6]">
                      {service.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 shrink-0">
                    <span className="text-base sm:text-lg font-medium text-[#292724] tabular-nums whitespace-nowrap">
                      {service.price}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectService(service)}
                      aria-label={`Записаться на услугу ${service.title}`}
                      className="px-4 py-2 text-xs font-medium text-[#292724] bg-[#FAF8F5] hover:bg-[#E9DED4] border border-[#EAE6E1] rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Записаться
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. ГАЛЕРЕЯ РАБОТ */}
        <section id="gallery" className="bg-[#FAF8F5] py-16 sm:py-24 border-y border-[#EAE6E1]">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <p className="text-xs tracking-[0.12em] text-[#827D76] mb-2">
                  ПРИМЕРЫ ЭСТЕТИКИ И РАБОТ
                </p>
                <h2 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#292724] leading-[1.15]">
                  Работы, которые говорят сами за себя
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#827D76]">
                Нажмите на изображение, чтобы открыть увеличенный просмотр
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
              <div className="md:col-span-5">
                <GalleryCard
                  item={GALLERY_ITEMS[0]}
                  onOpen={() => setLightboxIndex(0)}
                />
              </div>

              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                <GalleryCard
                  item={GALLERY_ITEMS[1]}
                  onOpen={() => setLightboxIndex(1)}
                />
                <GalleryCard
                  item={GALLERY_ITEMS[2]}
                  onOpen={() => setLightboxIndex(2)}
                />
                <div className="sm:col-span-2">
                  <GalleryCard
                    item={GALLERY_ITEMS[4]}
                    onOpen={() => setLightboxIndex(4)}
                  />
                </div>
              </div>

              <div className="md:col-span-5">
                <GalleryCard
                  item={GALLERY_ITEMS[3]}
                  onOpen={() => setLightboxIndex(3)}
                />
              </div>
              <div className="md:col-span-7">
                <GalleryCard
                  item={GALLERY_ITEMS[5]}
                  onOpen={() => setLightboxIndex(5)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 7. МАСТЕРА */}
        <section id="masters" className="bg-[#FFFFFF] py-16 sm:py-24">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
            <div className="mb-12">
              <p className="text-xs tracking-[0.12em] text-[#827D76] mb-2">
                КОМАНДА СТУДИИ
              </p>
              <h2 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#292724] leading-[1.15]">
                Люди, которым можно довериться
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {MASTERS.map((master) => (
                <article
                  key={master.id}
                  className="flex flex-col justify-between bg-[#FFFFFF] border border-[#EAE6E1] rounded-[6px] p-5 sm:p-6"
                >
                  <div>
                    <StudioImage
                      src={master.src}
                      alt={master.alt}
                      className="w-full aspect-[3/4] rounded-[4px] mb-5 border border-[#EAE6E1]"
                      imgClassName="hover:scale-[1.02]"
                    />
                    <div className="mb-3">
                      <h3 className="font-serif-display text-2xl font-medium text-[#292724]">
                        {master.name}
                      </h3>
                      <p className="text-xs text-[#827D76] mt-0.5">{master.role}</p>
                    </div>
                    <p className="text-sm text-[#827D76] leading-[1.65] mb-6">
                      {master.approach}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectMaster(master)}
                    className="w-full py-2.5 px-4 text-xs font-medium text-[#292724] bg-[#FAF8F5] hover:bg-[#E9DED4] border border-[#EAE6E1] rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Выбрать специалиста
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 8. ОТЗЫВЫ КЛИЕНТОВ */}
        <section id="reviews" className="bg-[#FAF8F5] py-16 sm:py-24 border-y border-[#EAE6E1]">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <p className="text-xs tracking-[0.12em] text-[#827D76] mb-2">
                  ВПЕЧАТЛЕНИЯ ГОСТЕЙ
                </p>
                <h2 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#292724] leading-[1.15]">
                  Нам приятно, когда вы возвращаетесь
                </h2>
              </div>
              <span className="text-xs text-[#827D76]">
                Примеры отзывов для демонстрации дизайна
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {REVIEWS.map((review) => (
                <article
                  key={review.id}
                  className="bg-[#FFFFFF] border border-[#EAE6E1] rounded-[6px] p-6 sm:p-7 flex flex-col justify-between"
                >
                  <p className="text-[15px] sm:text-base leading-[1.7] text-[#292724] mb-6">
                    {review.text}
                  </p>
                  <div className="pt-4 border-t border-[#EAE6E1] flex items-center justify-between text-xs">
                    <span className="font-medium text-[#292724]">{review.author}</span>
                    <span className="text-[#827D76]">{review.serviceNote}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 9. ОНЛАЙН-ЗАПИСЬ НА УСЛУГУ (Интеграция с Cloudflare Worker + D1) */}
        <BookingSection
          selectedServiceId={selectedServiceId}
          onSelectServiceId={setSelectedServiceId}
          selectedMasterId={selectedMasterId}
          onSelectMasterId={setSelectedMasterId}
          selectionBanner={selectionBanner}
          onClearBanner={() => setSelectionBanner(null)}
        />

        {/* 10. ЧАСТЫЕ ВОПРОСЫ (FAQ) */}
        <section id="faq" className="bg-[#FAF8F5] py-16 sm:py-24 border-t border-[#EAE6E1]">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
              <div className="lg:col-span-5">
                <p className="text-xs tracking-[0.12em] text-[#827D76] mb-2">
                  ОТВЕТЫ НА ВОПРОСЫ
                </p>
                <h2 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#292724] leading-[1.15] mb-4">
                  Частые вопросы о визите в студию
                </h2>
                <p className="text-sm sm:text-base text-[#827D76] leading-[1.65]">
                  Собрали короткие подсказки для тех, кто планирует прийти к нам впервые.
                </p>
              </div>

              <div className="lg:col-span-7 border-t border-[#EAE6E1] divide-y divide-[#EAE6E1]">
                {FAQ_ITEMS.map((item) => {
                  const isOpen = openFaqId === item.id;
                  return (
                    <div key={item.id} className="py-4 sm:py-5">
                      <button
                        type="button"
                        onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                        aria-expanded={isOpen}
                        aria-controls={`faq-panel-${item.id}`}
                        className="w-full flex items-center justify-between gap-4 text-left py-1 cursor-pointer group"
                      >
                        <span className="text-base font-medium text-[#292724] group-hover:text-[#827D76] transition-colors duration-150">
                          {item.question}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-[#827D76] shrink-0 transition-transform duration-150 ${
                            isOpen ? 'rotate-180 text-[#292724]' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                      {isOpen && (
                        <div
                          id={`faq-panel-${item.id}`}
                          className="pt-3 pr-6 text-sm sm:text-[15px] text-[#827D76] leading-[1.65]"
                        >
                          {item.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 11. КОНТАКТЫ */}
        <section id="contacts" className="bg-[#FFFFFF] py-16 sm:py-24 border-t border-[#EAE6E1]">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              <div className="lg:col-span-5">
                <p className="text-xs tracking-[0.12em] text-[#827D76] mb-2">
                  КОНТАКТНАЯ ИНФОРМАЦИЯ
                </p>
                <h2 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#292724] leading-[1.15] mb-4">
                  Будем рады знакомству
                </h2>
                <p className="text-sm sm:text-base text-[#827D76] leading-[1.65] mb-8 max-w-[42ch]">
                  Мы находимся в тихом светлом пространстве. Перед запуском реального проекта замените демонстрационные контактные данные на реквизиты вашего салона.
                </p>
                <button
                  type="button"
                  onClick={() => scrollToSection('booking')}
                  className="px-6 py-3 text-sm font-medium text-[#292724] bg-[#E9DED4] hover:bg-[#dfd1c4] rounded-[4px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Связаться со студией
                </button>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-[#FAF8F5] border border-[#EAE6E1] rounded-[6px] p-6 sm:p-8">
                <div>
                  <h3 className="text-xs tracking-[0.1em] uppercase font-sans font-medium text-[#827D76] mb-2">
                    Адрес студии
                  </h3>
                  <p className="text-base font-medium text-[#292724] mb-1">
                    Адрес для демонстрации — замените на реальный
                  </p>
                  <p className="text-xs text-[#827D76]">
                    Светлый вход со двора, первый этаж
                  </p>
                </div>

                <div>
                  <h3 className="text-xs tracking-[0.1em] uppercase font-sans font-medium text-[#827D76] mb-2">
                    Телефон
                  </h3>
                  <p className="text-base font-medium text-[#292724] tabular-nums mb-1">
                    +7 (000) 000-00-00
                  </p>
                  <p className="text-xs text-[#827D76]">
                    Демонстрационный номер — заглушка для макета
                  </p>
                </div>

                <div>
                  <h3 className="text-xs tracking-[0.1em] uppercase font-sans font-medium text-[#827D76] mb-2">
                    График работы
                  </h3>
                  <p className="text-base font-medium text-[#292724] mb-1">
                    Ежедневно, 10:00 — 21:00
                  </p>
                  <p className="text-xs text-[#827D76]">
                    Перерыв 14:30 — 15:00 (по предварительной записи)
                  </p>
                </div>

                <div>
                  <h3 className="text-xs tracking-[0.1em] uppercase font-sans font-medium text-[#827D76] mb-2">
                    Социальные сети (заглушки)
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[#292724]">
                    {['Telegram', 'VK', 'Pinterest'].map((network) => (
                      <button
                        key={network}
                        type="button"
                        onClick={() =>
                          setSocialDemoNotice(
                            `Ссылка на ${network} является демонстрационной заглушкой для макета портфолио.`
                          )
                        }
                        className="underline decoration-[#EAE6E1] underline-offset-4 hover:decoration-[#292724] transition-colors duration-150 cursor-pointer"
                      >
                        {network}
                      </button>
                    ))}
                  </div>
                  {socialDemoNotice && (
                    <p className="mt-2 text-xs text-[#827D76]" role="status">
                      {socialDemoNotice}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ПОДВАЛ САЙТА */}
      <footer className="bg-[#FAF8F5] border-t border-[#EAE6E1] py-10">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-[#EAE6E1]">
            <div>
              <span className="font-serif-display text-2xl tracking-[0.14em] text-[#292724]">
                LÉA
              </span>
              <span className="ml-3 text-xs tracking-[0.12em] text-[#827D76]">
                СТУДИЯ КРАСОТЫ
              </span>
            </div>

            <nav aria-label="Навигация в подвале" className="flex flex-wrap items-center gap-6 text-xs sm:text-sm text-[#827D76]">
              <a
                href="#services"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('services');
                }}
                className="hover:text-[#292724] transition-colors duration-150"
              >
                Услуги
              </a>
              <a
                href="#gallery"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('gallery');
                }}
                className="hover:text-[#292724] transition-colors duration-150"
              >
                Наши работы
              </a>
              <a
                href="#masters"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('masters');
                }}
                className="hover:text-[#292724] transition-colors duration-150"
              >
                Мастера
              </a>
              <a
                href="#reviews"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('reviews');
                }}
                className="hover:text-[#292724] transition-colors duration-150"
              >
                Отзывы
              </a>
              <a
                href="#contacts"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('contacts');
                }}
                className="hover:text-[#292724] transition-colors duration-150"
              >
                Контакты
              </a>
            </nav>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#827D76]">
            <p>© {new Date().getFullYear()} LÉA. Система онлайн-записи на базе Cloudflare Workers и D1.</p>
            <p>Демонстрационный проект с реальным бронированием слотов в БД.</p>
          </div>
        </div>
      </footer>

      {/* LIGHTBOX MODAL ДЛЯ ГАЛЕРЕИ */}
      {lightboxIndex !== null && GALLERY_ITEMS[lightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Просмотр работы: ${GALLERY_ITEMS[lightboxIndex].title}`}
          className="fixed inset-0 z-50 bg-[#292724]/85 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#FFFFFF] border border-[#EAE6E1] rounded-[6px] overflow-hidden shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EAE6E1]">
              <div className="flex items-center gap-2 text-xs text-[#827D76]">
                <span className="tabular-nums">
                  {lightboxIndex + 1} / {GALLERY_ITEMS.length}
                </span>
                <span aria-hidden="true">·</span>
                <span>{GALLERY_ITEMS[lightboxIndex].category}</span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Закрыть увеличенный просмотр"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#292724] hover:bg-[#FAF8F5] rounded-[4px] cursor-pointer"
              >
                <span>Закрыть</span>
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="bg-[#FAF8F5] max-h-[70vh] flex items-center justify-center overflow-hidden">
              <img
                src={resolvePublicAssetUrl(GALLERY_ITEMS[lightboxIndex].src)}
                alt={GALLERY_ITEMS[lightboxIndex].alt}
                referrerPolicy="no-referrer"
                className="max-h-[68vh] w-auto object-contain"
              />
            </div>

            <div className="px-5 py-4 border-t border-[#EAE6E1] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFFFF]">
              <div>
                <h3 className="font-serif-display text-xl text-[#292724]">
                  {GALLERY_ITEMS[lightboxIndex].title}
                </h3>
                <p className="text-xs sm:text-sm text-[#827D76]">
                  {GALLERY_ITEMS[lightboxIndex].caption}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex(
                      (lightboxIndex - 1 + GALLERY_ITEMS.length) % GALLERY_ITEMS.length
                    )
                  }
                  aria-label="Предыдущее изображение"
                  className="inline-flex items-center justify-center w-9 h-9 border border-[#EAE6E1] rounded-[4px] text-[#292724] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex((lightboxIndex + 1) % GALLERY_ITEMS.length)
                  }
                  aria-label="Следующее изображение"
                  className="inline-flex items-center justify-center px-3.5 h-9 border border-[#EAE6E1] rounded-[4px] text-xs font-medium text-[#292724] hover:bg-[#FAF8F5] gap-1.5 cursor-pointer"
                >
                  <span>Далее</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface GalleryCardProps {
  item: (typeof GALLERY_ITEMS)[number];
  onOpen: () => void;
}

function GalleryCard({ item, onOpen }: GalleryCardProps) {
  return (
    <figure className="m-0 group">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть фото: ${item.title}`}
        className="w-full text-left block cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#292724] rounded-[6px]"
      >
        <StudioImage
          src={item.src}
          alt={item.alt}
          className={`w-full ${item.aspectClass} rounded-[6px] border border-[#EAE6E1]`}
          imgClassName="group-hover:scale-[1.02]"
        />
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium text-[#292724] group-hover:text-[#827D76] transition-colors duration-150">
            {item.title}
          </span>
          <span className="text-xs text-[#827D76] shrink-0">{item.category}</span>
        </div>
      </button>
    </figure>
  );
}
