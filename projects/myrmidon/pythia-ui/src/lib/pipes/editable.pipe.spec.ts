import { EditableCheckService } from '../services/editable-check.service';
import { EditablePipe } from './editable.pipe';

describe('EditablePipe', () => {
  it('should delegate to EditableCheckService', () => {
    const isEditable = vi.fn().mockReturnValue(true);
    const pipe = new EditablePipe({
      isEditable,
    } as unknown as EditableCheckService);

    expect(pipe.transform({ userId: 'zeus' })).toBe(true);
    expect(isEditable).toHaveBeenCalledWith({ userId: 'zeus' });

    isEditable.mockReturnValue(false);
    expect(pipe.transform({ userId: 'hera' })).toBe(false);
  });
});
