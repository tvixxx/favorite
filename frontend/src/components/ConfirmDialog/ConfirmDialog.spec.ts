import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ConfirmDialog from './ConfirmDialog.vue';

describe('Подтверждение удаления', () => {
  it('показывает название отдельно от вопроса и не удаляет при отмене', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { modelValue: true, title: 'Удалить из коллекции?', subject: 'Йеллоустоун (Yellowstone)', description: 'Оценка и прогресс будут удалены.' },
      global: { stubs: { BaseModal: { template: '<section><slot name="body"/><slot name="footer"/></section>' }, BaseIcon: true } },
    });
    expect(wrapper.get('h3').text()).toBe('Удалить из коллекции?');
    expect(wrapper.get('.confirm-dialog__subject').text()).toBe('Йеллоустоун (Yellowstone)');
    await wrapper.get('.confirm-dialog__btn--ghost').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    expect(wrapper.emitted('confirm')).toBeUndefined();
    wrapper.unmount();
  });
});
