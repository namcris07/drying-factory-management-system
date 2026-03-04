import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  it('returns greeting text for root endpoint', () => {
    expect(service.getHello()).toBe('Hello World!');
  });

  it('returns a stable greeting to prevent regression', () => {
    const first = service.getHello();
    const second = service.getHello();

    expect(first).toBe(second);
  });
});
