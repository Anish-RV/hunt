// @flow

import './App.css';
import React from 'react';
import PasswordGate from './PasswordGate';

export default function App(): React.MixedElement {
  return (
    <div className="App">
      <PasswordGate />
    </div>
  );
}