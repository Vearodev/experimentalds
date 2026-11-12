import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { Info } from 'lucide-react';
import { IconButton } from './Button';
import { Tooltip } from './Tooltip';

it('reveals a field description on keyboard focus and dismisses it with Escape', async () => {
  render(
    <Tooltip content="Выделенная оперативная память, в GiB">
      <IconButton icon={<Info />} aria-label="О поле RAM" />
    </Tooltip>,
  );
  const user = userEvent.setup();
  await user.tab();
  expect(screen.getByRole('button')).toHaveAccessibleDescription(
    'Выделенная оперативная память, в GiB',
  );
  expect(screen.getByRole('tooltip')).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveFocus();
});
