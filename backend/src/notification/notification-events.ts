import { EventEmitter } from 'node:events';

// Общий канал процесса, подписка WebSocket освобождается при остановке gateway.
export const notificationEvents = new EventEmitter();
