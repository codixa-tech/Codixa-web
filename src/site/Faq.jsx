import { Plus } from 'lucide-react';

/** FAQ accordion built on <details>, so answers stay in the HTML for crawlers and work without JS. */
export default function Faq({ title, items, id = 'faq', tone = 'light' }) {
  return (
    <section className={`section faq faq--${tone}`} id={id} aria-labelledby={`${id}-title`}>
      <div className="container faq__grid">
        <h2 id={`${id}-title`} className="h2">
          {title}
        </h2>
        <div className="faq__list">
          {items.map((f, i) => (
            <details key={f.q} className="faq__item" open={i === 0}>
              <summary>
                <h3>{f.q}</h3>
                <Plus size={20} aria-hidden="true" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
