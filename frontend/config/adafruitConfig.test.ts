import { AIO_THRESHOLDS, getMachineFeeds } from '@/config/adafruitConfig';

describe('adafruitConfig', () => {
  it('builds correct feed keys from machine id and normalizes to lowercase', () => {
    const feeds = getMachineFeeds('M-A1');

    expect(feeds).toEqual({
      temperature: 'drytech.m-a1-temperature',
      humidity: 'drytech.m-a1-humidity',
      light: 'drytech.m-a1-light',
      fan: 'drytech.m-a1-fan',
      relay: 'drytech.m-a1-relay',
      lcd: 'drytech.m-a1-lcd',
    });
  });

  it('keeps warning thresholds stable', () => {
    expect(AIO_THRESHOLDS).toEqual({
      tempMax: 90,
      tempWarn: 82,
      humMin: 8,
      humMax: 85,
      lightDoor: 700,
    });
  });
});
