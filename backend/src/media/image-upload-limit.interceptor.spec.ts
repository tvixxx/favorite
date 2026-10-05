import { of, Subject } from 'rxjs';
import { ImageUploadLimit } from './image-upload-limit.interceptor';

it('ограничивает приём multipart до выделения памяти и освобождает слот', () => {
  const limiter = new ImageUploadLimit();
  const pending = [new Subject(), new Subject(), new Subject()];
  const subscriptions = pending.map((stream) =>
    limiter.intercept({} as never, { handle: () => stream }).subscribe(),
  );

  expect(() =>
    limiter.intercept({} as never, { handle: () => of(null) }),
  ).toThrow();
  subscriptions[0].unsubscribe();
  expect(() =>
    limiter.intercept({} as never, { handle: () => of(null) }).subscribe(),
  ).not.toThrow();
  subscriptions.forEach((subscription) => subscription.unsubscribe());
});
