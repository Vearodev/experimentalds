import { useEffect, useState } from 'react';
import { Layers, Move, ShieldCheck, SlidersHorizontal, Terminal } from 'lucide-react';
import {
  Button,
  ConsoleWorkspace,
  Select,
  type ConsoleResource,
  type ConsoleStatus,
} from '@basis/ui';
import { useConsoleSessions } from '../../cloud/src/useConsoleSessions';
import { PageHeading, SectionHeading } from './PageParts';
import { ComponentTokens } from './TokenPanel';
import { useDesign } from './DesignContext';
import './console-page.css';

const machines: ConsoleResource[] = [
  {
    id: 'console-api',
    name: 'prod-api-01',
    project: 'Production',
    host: 'msk-host-01',
    address: '10.20.0.14',
    system: 'Ubuntu 24.04 LTS',
    cpu: 8,
    memory: 16,
    available: true,
  },
  {
    id: 'console-db',
    name: 'prod-postgres-01',
    project: 'Production',
    host: 'msk-host-02',
    address: '10.20.0.25',
    system: 'Debian 12',
    cpu: 16,
    memory: 32,
    available: true,
  },
  {
    id: 'console-web',
    name: 'stage-web-01',
    project: 'Staging',
    host: 'spb-host-01',
    address: '10.30.0.11',
    system: 'Ubuntu 24.04 LTS',
    cpu: 4,
    memory: 8,
    available: true,
  },
  {
    id: 'console-test',
    name: 'test-worker-02',
    project: 'Development',
    host: 'msk-host-03',
    address: '10.40.0.18',
    system: 'AlmaLinux 9',
    cpu: 2,
    memory: 4,
    available: false,
  },
];
export function ConsolePage() {
  const design = useDesign();
  const console = useConsoleSessions(machines);
  const [floating, setFloating] = useState(false);
  const restore = () => {
    console.open(machines[0]);
    console.open(machines[1]);
    console.dispatch({ type: 'select', id: machines[0].id });
  };
  useEffect(restore, []);
  const active = console.state.sessions.find((s) => s.resource.id === console.state.activeId);
  return (
    <>
      <PageHeading
        category="Составной компонент · Рабочее пространство"
        title="Консоли виртуальных машин"
        description="Несколько машин в одном плавающем окне. Консоль остаётся рядом с инфраструктурой, сохраняет контекст и освобождает экран по одному нажатию."
      >
        <Button
          size="sm"
          leadingIcon={<SlidersHorizontal />}
          onClick={() => design.openComponent('console')}
        >
          Токены компонента
        </Button>
      </PageHeading>
      <section className="ds-section">
        <SectionHeading number="01" title="Рабочее окно" note="Живой компонент · обе темы" />
        <div className="console-lab__controls">
          <p>Переключайте машины, вводите команды и добавляйте сессии через «+».</p>
          {active && (
            <Select
              label="Состояние активной консоли"
              value={active.status}
              onValueChange={(status) =>
                console.dispatch({
                  type: 'status',
                  id: active.resource.id,
                  status: status as ConsoleStatus,
                })
              }
              options={[
                { value: 'connected', label: 'Подключено' },
                { value: 'connecting', label: 'Подключение' },
                { value: 'disconnected', label: 'Отключено' },
                { value: 'error', label: 'Ошибка подключения' },
                { value: 'stopped', label: 'Машина выключена' },
              ]}
            />
          )}
        </div>
        {floating && active ? (
          <div className="console-lab__floating-note">
            <Terminal />
            <div>
              <strong>Консоли работают поверх страницы</strong>
              <p>
                Переместите окно за шапку, измените размер за край или сверните его в компактную
                панель.
              </p>
            </div>
            <Button
              onClick={() => {
                setFloating(false);
                console.dispatch({ type: 'restore' });
              }}
            >
              Вернуть в образец
            </Button>
          </div>
        ) : (
          !active && (
            <div className="console-lab__floating-note">
              <Terminal />
              <p>Все сессии закрыты.</p>
              <Button onClick={restore}>Открыть образец</Button>
            </div>
          )
        )}
        <ConsoleWorkspace
          {...console.props}
          embedded={!floating}
          onDetach={() => {
            setFloating(true);
            console.dispatch({ type: 'restore' });
          }}
        />
        <div className="console-lab__caption">
          <span>Вкладки 48 · действия 40 · отступ терминала 16</span>
          <span>Onest / моноширинный терминал</span>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Поведение, которое сохраняет контекст" />
        <div className="console-lab__rules">
          <article>
            <Layers />
            <strong>Одна машина — одна вкладка</strong>
            <p>
              Повторное открытие выбирает существующую сессию. История и незавершённая команда
              принадлежат машине. Вкладки можно переставлять мышью и с клавиатуры.
            </p>
          </article>
          <article>
            <Move />
            <strong>Окно остаётся с пользователем</strong>
            <p>
              Переходы по порталу и сворачивание не отключают консоли. Размер и положение ограничены
              экраном. Разворачивание сохраняет предыдущую геометрию.
            </p>
          </article>
          <article>
            <ShieldCheck />
            <strong>Явный адресат ввода</strong>
            <p>
              В панели пароля показано имя ВМ. Секрет очищается при отправке, смене вкладки и
              сворачивании; не попадает в историю. Закрытие консоли не выключает машину.
            </p>
          </article>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="03"
          title="Параметры дизайна и наследование"
          note="ref → sys → comp"
        />
        <p className="console-lab__token-note">
          Оболочка наследует поверхности, границы и состояния общих компонентов. Терминал использует
          отдельные семантические роли sys.color.console: тёмный фон и контрастный текст остаются
          постоянными в обеих темах. Метрики окна идут через sys.layout.console; кнопки, меню, поля
          и вкладки используют собственные токены ДС.
        </p>
        <ComponentTokens component="console" />
      </section>
    </>
  );
}
