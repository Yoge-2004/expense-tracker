import { CurrencySelectorModal } from '../components/profile/CurrencySelectorModal';
import { SecurityPinModal } from '../components/profile/SecurityPinModal';
import { AvatarEditModal } from '../components/profile/AvatarEditModal';
import { DeleteAccountModal } from '../components/profile/DeleteAccountModal';

describe('Profile Modular Components', () => {
  it('CurrencySelectorModal exports a valid memo component', () => {
    expect(CurrencySelectorModal).toBeDefined();
    expect(typeof CurrencySelectorModal).toBe('object');
  });

  it('SecurityPinModal exports a valid memo component', () => {
    expect(SecurityPinModal).toBeDefined();
    expect(typeof SecurityPinModal).toBe('object');
  });

  it('AvatarEditModal exports a valid memo component', () => {
    expect(AvatarEditModal).toBeDefined();
    expect(typeof AvatarEditModal).toBe('object');
  });

  it('DeleteAccountModal exports a valid memo component', () => {
    expect(DeleteAccountModal).toBeDefined();
    expect(typeof DeleteAccountModal).toBe('object');
  });
});
