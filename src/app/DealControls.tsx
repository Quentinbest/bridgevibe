import { useRef } from 'react';
import type { Deal } from '../table';
import { text } from '../explanation';

export function DealControls({ info, onNew }: { info: Pick<Deal, 'dealId' | 'origin'>; onNew: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const origin = info.origin;
  return <div className="deal-controls">
    <button type="button" onClick={onNew}>{text('deal.new')}</button>
    <button type="button" ref={trigger} onClick={() => dialog.current?.showModal()}>{text('deal.info')}</button>
    <dialog ref={dialog} className="deal-info" aria-labelledby="deal-info-title" onClose={() => trigger.current?.focus()}>
      <h2 id="deal-info-title">{text('deal.info')}</h2>
      <dl>
        <dt>{text('deal.id')}</dt><dd data-testid="deal-id">{info.dealId}</dd>
        <dt>{text('deal.origin')}</dt><dd>{text(`deal.${origin.kind}`)}</dd>
        {origin.kind === 'seed' ? <>
          <dt>{text('deal.seed')}</dt><dd>{origin.seed}</dd>
          <dt>{text('deal.index')}</dt><dd>{origin.index}</dd>
          {origin.rotation !== 0 && <>
            <dt>{text('deal.rotation')}</dt><dd>{origin.rotation}</dd>
          </>}
          <dt>{text('deal.algorithm')}</dt><dd>{text('deal.value', { value: origin.algorithm })}</dd>
        </> : <>
          <dt>{text('deal.content')}</dt><dd>{origin.contentId}</dd>
          <dt>{text('deal.version')}</dt><dd>{origin.version}</dd>
        </>}
      </dl>
      <button type="button" onClick={() => dialog.current?.close()}>{text('deal.close')}</button>
    </dialog>
  </div>;
}
