import { fireEvent, screen } from '@testing-library/react';

// UX §2.3: existing practice scenarios enter Home without altering direct-link scenarios.
export function openPractice() {
  const launcher = screen.queryByRole('link', { name: /^Quick game/ });
  if (launcher) fireEvent.click(launcher);
}
