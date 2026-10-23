import { AppController } from './app.controller.js';
describe('AppController', () => {
  it('reports health', () => { expect(new AppController().getHealth()).toEqual({ status: 'ok' }); });
});
