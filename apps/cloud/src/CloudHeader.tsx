import { useId } from 'react';
import { Languages, Moon, Sun, UserRound } from 'lucide-react';
import { Avatar, Menu } from '@basis/ui';
import type { Profile } from '../domain';
import type { PlatformMode } from '../platform-types';
import { useDesign } from '../../playground/src/DesignContext';
import { navigate } from './parts';

export function CloudBrand() {
  const accent = useId();
  const glyph = useId();
  const logo = `${import.meta.env.BASE_URL}basis-logo.png`;
  return (
    <a className="cloud-brand" href="#cloud/overview" aria-label="Basis statix — обзор">
      <svg
        className="cloud-wordmark"
        viewBox="430 140 370 420"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={glyph}>
            <path d="M435 554h79L653 327l-40-64Z M631 419l82 135h79L672 355Z M632 234h78L764 146h-78Z" />
          </clipPath>
          <clipPath id={accent}>
            <rect x="625" y="140" width="150" height="100" />
          </clipPath>
        </defs>
        <image
          className="cloud-wordmark__base"
          href={logo}
          width="1680"
          height="786"
          clipPath={`url(#${glyph})`}
        />
        <image href={logo} width="1680" height="786" clipPath={`url(#${accent})`} />
      </svg>
      <span className="cloud-brand__name" aria-hidden="true">
        Basis statix
      </span>
    </a>
  );
}

export function CloudUserMenu({ profile, mode }: { profile?: Profile; mode: PlatformMode }) {
  const design = useDesign();
  const name = profile?.name || 'Пользователь';
  const role =
    mode === 'admin' ? 'Администратор' : mode === 'reader' ? 'Наблюдатель' : 'Пользователь';
  return (
    <Menu
      label={`Профиль: ${name}`}
      variant="ghost"
      size="lg"
      align="end"
      disabled={!profile}
      triggerContent={
        <span className="cloud-user-trigger">
          <span className="cloud-user-trigger__avatar" aria-hidden="true">
            <Avatar name={name} size="sm" />
          </span>
          <span className="cloud-user-trigger__copy">
            <strong className="cloud-user-trigger__name">{name}</strong>
            <strong className="cloud-user-trigger__short" aria-hidden="true">
              {name.trim().split(/\s+/)[0]}
            </strong>
            <small>{role}</small>
          </span>
        </span>
      }
      header={
        <div className="cloud-user-summary">
          <Avatar name={name} size="md" />
          <div className="cloud-user-summary__copy">
            <strong>{name}</strong>
            <span className="cloud-user-summary__role">{role}</span>
            <span className="cloud-user-summary__email">{profile?.email}</span>
          </div>
        </div>
      }
      items={[
        {
          id: 'profile',
          label: 'Настройки профиля',
          icon: <UserRound />,
          onSelect: () => navigate('settings'),
        },
        {
          id: 'theme',
          label: 'Тема интерфейса',
          icon: design.theme === 'light' ? <Sun /> : <Moon />,
          description: design.theme === 'light' ? 'Светлая' : 'Тёмная',
          children: [
            {
              id: 'light',
              label: 'Светлая',
              icon: <Sun />,
              checked: design.theme === 'light',
              onSelect: () => design.setTheme('light'),
            },
            {
              id: 'dark',
              label: 'Тёмная',
              icon: <Moon />,
              checked: design.theme === 'dark',
              onSelect: () => design.setTheme('dark'),
            },
          ],
        },
        {
          id: 'language',
          label: 'Язык интерфейса',
          icon: <Languages />,
          description: 'Русский',
          children: [
            { id: 'ru', label: 'Русский', checked: true },
            {
              id: 'en',
              label: 'English',
              checked: false,
              disabled: true,
              description: 'Перевод пока недоступен',
            },
          ],
        },
      ]}
    />
  );
}
