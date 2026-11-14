import React from 'react';
import { Platform } from 'react-native';
import { CapturePermissionBanner } from '../components/dashboard/CapturePermissionBanner';
import { Colors } from '../constants/theme';

describe('CapturePermissionBanner Component', () => {
  it('exports a valid memo component', () => {
    expect(CapturePermissionBanner).toBeDefined();
    expect(typeof CapturePermissionBanner).toBe('object');
  });

  it('instantiates cleanly with theme colors without runtime exceptions', () => {
    const element = React.createElement(CapturePermissionBanner, {
      colors: Colors.light,
    });
    expect(element).toBeDefined();
    expect(element.props.colors).toEqual(Colors.light);
  });
});
