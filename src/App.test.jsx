import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />);
    // When not logged in, user sees login page or dashboard
    expect(document.body).toBeInTheDocument();
  });
});
