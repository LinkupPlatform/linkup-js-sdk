import { getVersionFromPackage } from '../../utils/version.utils';

it('should return package version', () => {
  expect(getVersionFromPackage()).toEqual('1.0.1');
});
