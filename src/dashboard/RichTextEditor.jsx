import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Baseline,
  Eraser,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { processImage } from '../lib/media.js';
import '../styles/prose.css';
import './richtext.css';

const SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px'];
const COLORS = ['#0f172a', '#475569', '#2563eb', '#06b6d4', '#16a34a', '#d97706', '#dc2626', '#9333ea'];
const MARKS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e2e8f0'];

/**
 * Rich-text editor for the dashboard. Produces HTML; the server sanitizes it again before saving.
 * `uploadImage(blob, name)` stores an image and returns `{ src }`.
 */
export default function RichTextEditor({ value, onChange, dir = 'rtl', placeholder = '', uploadImage, id, label }) {
  const { t } = useI18n();
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState(''); // 'color' | 'mark' | 'link'
  const [link, setLink] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, codeBlock: false, code: false, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      TextStyleKit.configure({ fontFamily: false, lineHeight: false }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: { attributes: { class: 'rte__content prose', dir, 'aria-label': label || '', ...(id ? { id } : {}) } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
    immediatelyRender: true,
  });

  // Replace the content when the record changes from outside (not while typing).
  useEffect(() => {
    if (editor && !editor.isFocused && (value || '') !== (editor.isEmpty ? '' : editor.getHTML())) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            strike: e.isActive('strike'),
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            h4: e.isActive('heading', { level: 4 }),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            quote: e.isActive('blockquote'),
            link: e.isActive('link'),
            align: ['left', 'center', 'right', 'justify'].find((a) => e.isActive({ textAlign: a })) || '',
            size: e.getAttributes('textStyle').fontSize || '',
            color: e.getAttributes('textStyle').color || '',
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : {},
  });

  if (!editor) return null;
  const run = () => editor.chain().focus();

  const block = (v) => {
    if (v === 'p') run().setParagraph().run();
    else run().toggleHeading({ level: Number(v) }).run();
  };
  const blockValue = state.h2 ? '2' : state.h3 ? '3' : state.h4 ? '4' : 'p';

  const addImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast(t('dash.rte.notImage'), 'err');
    setBusy(true);
    try {
      const rec = await processImage(file, uploadImage);
      run().setImage({ src: rec.src, alt: '' }).run();
    } catch {
      toast(t('dash.rte.uploadFail'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const openLink = () => {
    setLink(editor.getAttributes('link').href || 'https://');
    setPop(pop === 'link' ? '' : 'link');
  };
  const applyLink = (e) => {
    e.preventDefault();
    const href = link.trim();
    if (!href || href === 'https://') run().extendMarkRange('link').unsetLink().run();
    else run().extendMarkRange('link').setLink({ href, target: /^https?:/.test(href) ? '_blank' : null }).run();
    setPop('');
  };

  const Btn = ({ on, label: l, onClick, children, disabled }) => (
    <button type="button" className={`rte__btn ${on ? 'is-on' : ''}`} aria-pressed={on === undefined ? undefined : !!on} aria-label={l} title={l} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );

  // Visual alignment icons follow the writing direction: "start" is right in Arabic.
  const alignOrder = dir === 'rtl' ? ['right', 'center', 'left', 'justify'] : ['left', 'center', 'right', 'justify'];
  const AlignIcon = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify };

  return (
    <div className={`rte ${busy ? 'is-busy' : ''}`} dir={dir}>
      <div className="rte__bar" role="toolbar" aria-label={t('dash.rte.toolbar')}>
        <select className="rte__select" value={blockValue} onChange={(e) => block(e.target.value)} aria-label={t('dash.rte.block')}>
          <option value="p">{t('dash.rte.paragraph')}</option>
          <option value="2">{t('dash.rte.h2')}</option>
          <option value="3">{t('dash.rte.h3')}</option>
          <option value="4">{t('dash.rte.h4')}</option>
        </select>
        <select
          className="rte__select rte__select--size"
          value={state.size}
          onChange={(e) => (e.target.value ? run().setFontSize(e.target.value).run() : run().unsetFontSize().run())}
          aria-label={t('dash.rte.size')}
        >
          <option value="">{t('dash.rte.sizeDefault')}</option>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {parseInt(s, 10)}
            </option>
          ))}
        </select>
        <span className="rte__sep" />
        <Btn on={state.bold} label={t('dash.rte.bold')} onClick={() => run().toggleBold().run()}>
          <Bold size={17} />
        </Btn>
        <Btn on={state.italic} label={t('dash.rte.italic')} onClick={() => run().toggleItalic().run()}>
          <Italic size={17} />
        </Btn>
        <Btn on={state.underline} label={t('dash.rte.underline')} onClick={() => run().toggleUnderline().run()}>
          <Underline size={17} />
        </Btn>
        <Btn on={state.strike} label={t('dash.rte.strike')} onClick={() => run().toggleStrike().run()}>
          <Strikethrough size={17} />
        </Btn>
        <span className="rte__popwrap">
          <Btn on={pop === 'color'} label={t('dash.rte.color')} onClick={() => setPop(pop === 'color' ? '' : 'color')}>
            <Baseline size={17} />
            <span className="rte__swatchbar" style={{ background: state.color || 'currentColor' }} />
          </Btn>
          {pop === 'color' && (
            <Palette
              colors={COLORS}
              label={t('dash.rte.color')}
              resetLabel={t('dash.rte.reset')}
              onPick={(c) => {
                (c ? run().setColor(c) : run().unsetColor()).run();
                setPop('');
              }}
            />
          )}
        </span>
        <span className="rte__popwrap">
          <Btn on={pop === 'mark'} label={t('dash.rte.highlight')} onClick={() => setPop(pop === 'mark' ? '' : 'mark')}>
            <Highlighter size={17} />
          </Btn>
          {pop === 'mark' && (
            <Palette
              colors={MARKS}
              label={t('dash.rte.highlight')}
              resetLabel={t('dash.rte.reset')}
              onPick={(c) => {
                (c ? run().setBackgroundColor(c) : run().unsetBackgroundColor()).run();
                setPop('');
              }}
            />
          )}
        </span>
        <span className="rte__sep" />
        {alignOrder.map((a) => {
          const Icon = AlignIcon[a];
          return (
            <Btn key={a} on={state.align === a} label={t(`dash.rte.align_${a}`)} onClick={() => (state.align === a ? run().unsetTextAlign().run() : run().setTextAlign(a).run())}>
              <Icon size={17} />
            </Btn>
          );
        })}
        <span className="rte__sep" />
        <Btn on={state.bullet} label={t('dash.rte.bullets')} onClick={() => run().toggleBulletList().run()}>
          <List size={17} />
        </Btn>
        <Btn on={state.ordered} label={t('dash.rte.numbers')} onClick={() => run().toggleOrderedList().run()}>
          <ListOrdered size={17} />
        </Btn>
        <Btn on={state.quote} label={t('dash.rte.quote')} onClick={() => run().toggleBlockquote().run()}>
          <Quote size={17} />
        </Btn>
        <span className="rte__popwrap">
          <Btn on={state.link || pop === 'link'} label={t('dash.rte.link')} onClick={openLink}>
            <Link2 size={17} />
          </Btn>
          {pop === 'link' && (
            <form className="rte__pop rte__linkpop" onSubmit={applyLink}>
              <input dir="ltr" type="text" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} aria-label={t('dash.rte.linkUrl')} autoFocus />
              <button type="submit" className="btn btn--sm">
                {t('dash.rte.apply')}
              </button>
            </form>
          )}
        </span>
        <Btn label={t('dash.rte.image')} onClick={() => fileRef.current?.click()} disabled={busy}>
          <ImagePlus size={17} />
        </Btn>
        <Btn label={t('dash.rte.rule')} onClick={() => run().setHorizontalRule().run()}>
          <Minus size={17} />
        </Btn>
        <span className="rte__sep" />
        <Btn label={t('dash.rte.clear')} onClick={() => run().unsetAllMarks().clearNodes().unsetTextAlign().run()}>
          <Eraser size={17} />
        </Btn>
        <Btn label={t('dash.rte.undo')} onClick={() => run().undo().run()} disabled={!state.canUndo}>
          <Undo2 size={17} />
        </Btn>
        <Btn label={t('dash.rte.redo')} onClick={() => run().redo().run()} disabled={!state.canRedo}>
          <Redo2 size={17} />
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            addImage(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <EditorContent editor={editor} />
      {busy && <p className="rte__busy muted small">{t('dash.rte.uploading')}</p>}
    </div>
  );
}

function Palette({ colors, onPick, label, resetLabel }) {
  return (
    <div className="rte__pop rte__palette" role="group" aria-label={label}>
      {colors.map((c) => (
        <button key={c} type="button" className="rte__swatch" style={{ background: c }} onClick={() => onPick(c)} aria-label={c} title={c} />
      ))}
      <label className="rte__swatch rte__swatch--custom" title={label}>
        <input type="color" onChange={(e) => onPick(e.target.value)} aria-label={label} />
      </label>
      <button type="button" className="rte__reset" onClick={() => onPick('')}>
        {resetLabel}
      </button>
    </div>
  );
}
