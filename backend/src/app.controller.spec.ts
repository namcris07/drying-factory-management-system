import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('delegates response generation to AppService', () => {
      const spy = jest.spyOn(appService, 'getHello').mockReturnValue('Mocked');

      expect(appController.getHello()).toBe('Mocked');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
