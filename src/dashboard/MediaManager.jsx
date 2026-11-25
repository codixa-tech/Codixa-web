import { useRef, useState } from 'react';
import { ImagePlus, Film, Trash2, ChevronUp, ChevronDown, Star } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { Img } from '../components/Media.jsx';
import { useMediaUrl } from '../lib/useMedia.js';
import { bytes } from '../lib/format.js';
import { MAX_IMAGES, VIDEO_MAX_MB, VIDEO_MAX_SECONDS, processImage, processVideo } from '../lib/media.js';

export default function MediaManager({ images = [], videos = [], onImages, onVideos, upload }) {
  const { t } = useI18n();
  const toast = useToast();
  const imgInput = useRef(null);
  const vidInput = useRef(null);
  const [busy, setBusy] = useState('');
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState({ before: 0, after: 0 });

  const addImages = async (fileList) => {
    const files = [...fileList];
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return toast(t('dash.media.limit', { n: MAX_IMAGES }), 'err');
    const accepted = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) toast(t('dash.media.notImage', { name: f.name }), 'err');
      else accepted.push(f);
    }
    if (accepted.length > room) toast(t('dash.media.limit', { n: MAX_IMAGES }), 'err');
    const batch = accepted.slice(0, room);
    const out = [];
    let before = 0;
    let after = 0;
    for (const f of batch) {
      setBusy(t('dash.media.processing', { n: f.name }));
      try {
        const rec = await processImage(f, upload);
        before += rec.originalBytes;
        after += rec.bytes;
        out.push(rec);
      } catch {
        toast(t('dash.media.notImage', { name: f.name }), 'err');
      }
    }
    setBusy('');
    if (out.length) {
      onImages([...images, ...out]);
      setSaving({ before, after });
    }
  };

  const addVideo = async (fileList) => {
    const out = [];
    for (const f of [...fileList]) {
      setBusy(t('dash.media.processing', { n: f.name }));
      try {
        out.push(await processVideo(f));
      } catch (e) {
        toast(t(`dash.media.${e.code || 'notVideo'}`, { name: f.name, mb: VIDEO_MAX_MB, sec: VIDEO_MAX_SECONDS }), 'err');
      }
    }
    setBusy('');
    if (out.length) onVideos([...videos, ...out]);
  };

  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onImages(next);
  };
  const cover = (i) => {
    const next = [...images];
    const [x] = next.splice(i, 1);
    onImages([x, ...next]);
  };

  const pct = saving.before ? Math.max(0, Math.round((1 - saving.after / saving.before) * 100)) : 0;

  return (
    <div className="stack">
      <section>
        <div className="sechead">
          <div>
            <h3>
              {t('dash.media.images')} <span className="muted num">({images.length}/{MAX_IMAGES})</span>
            </h3>
            <p className="muted small">{t('dash.media.imagesHint')}</p>
          </div>
          {pct > 0 && (
            <p className="savings" role="status" dir="auto">
              {t('dash.media.original')} <b className="num">{bytes(saving.before)}</b> → {t('dash.media.compressed')} <b className="num">{bytes(saving.after)}</b> · {t('dash.media.saved', { pct })}
            </p>
          )}
        </div>

        <div
          className={`drop ${over ? 'is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            addImages(e.dataTransfer.files);
          }}
        >
          <ImagePlus size={26} />
          <p>{busy || t('dash.media.drop')}</p>
          <button type="button" className="btn btn--sm" onClick={() => imgInput.current?.click()} disabled={!!busy}>
            {t('dash.media.choose')}
          </button>
          <input
            ref={imgInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addImages(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {images.length > 0 && (
          <ul className="mgrid">
            {images.map((im, i) => (
              <li key={im.id} className={`mtile ${i === 0 ? 'is-cover' : ''}`}>
                <Img src={im.thumb || im.src} w={im.w} h={im.h} alt="" />
                {i === 0 && (
                  <span className="mtile__cover">
                    <Star size={12} /> {t('dash.media.cover')}
                  </span>
                )}
                {im.bytes && <span className="mtile__size num">{bytes(im.bytes)}</span>}
                <div className="mtile__tools">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('dash.media.moveUp')} title={t('dash.media.moveUp')}>
                    <ChevronUp size={16} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label={t('dash.media.moveDown')} title={t('dash.media.moveDown')}>
                    <ChevronDown size={16} />
                  </button>
                  {i !== 0 && (
                    <button type="button" onClick={() => cover(i)} aria-label={t('dash.media.makeCover')} title={t('dash.media.makeCover')}>
                      <Star size={16} />
                    </button>
                  )}
                  <button type="button" className="danger" onClick={() => onImages(images.filter((x) => x.id !== im.id))} aria-label={t('dash.media.remove')} title={t('dash.media.remove')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {onVideos && (
      <section>
        <div className="sechead">
          <div>
            <h3>{t('dash.media.videos')}</h3>
            <p className="muted small">{t('dash.media.videosHint', { mb: VIDEO_MAX_MB, sec: VIDEO_MAX_SECONDS })}</p>
          </div>
          <button type="button" className="btn btn--sm btn--ghost dark-ghost" onClick={() => vidInput.current?.click()} disabled={!!busy}>
            <Film size={17} /> {t('dash.media.chooseVideo')}
          </button>
          <input
            ref={vidInput}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            hidden
            onChange={(e) => {
              addVideo(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        {videos.length > 0 && (
          <ul className="vlist">
            {videos.map((v) => (
              <VideoTile key={v.id} v={v} onRemove={() => onVideos(videos.filter((x) => x.id !== v.id))} />
            ))}
          </ul>
        )}
      </section>
      )}
    </div>
  );
}

function VideoTile({ v, onRemove }) {
  const { t } = useI18n();
  const poster = useMediaUrl(v.poster);
  return (
    <li className={`vtile ${v.vertical ? 'is-vertical' : ''}`}>
      <div className="vtile__poster" style={poster ? { backgroundImage: `url(${poster})` } : undefined}>
        <Film size={20} />
      </div>
      <div className="vtile__meta">
        <span className="vtile__name" dir="ltr">
          {v.name}
        </span>
        <span className="muted small num">
          {v.duration}s · {bytes(v.bytes)} · {v.w}×{v.h}
        </span>
      </div>
      <button type="button" className="iconbtn danger" onClick={onRemove} aria-label={t('dash.media.remove')}>
        <Trash2 size={17} />
      </button>
    </li>
  );
}
