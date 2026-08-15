import React, { act } from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      render(<App />);
    });
    // When not logged in, user sees login page or dashboard
    expect(document.body).toBeInTheDocument();
  });
});
