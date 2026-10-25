import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { mediaUrl, removable, type Note } from './notes'

const KIND: Record<Note['kind'], string> = { text: 'note', voice: 'voice', photo: 'photo' }

const when = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** How much is left here, in the bar beside the room's own counts. */
export function NoteCount({ notes }: { notes: readonly Note[] }) {
  return <Badge variant={notes.length === 0 ? 'outline' : 'secondary'}>
    {notes.length === 0 ? 'nothing left here yet' : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} left here`}
  </Badge>
}

type Props = {
  app: string
  note: Note
  playing: boolean
  onPlay: () => void
  onStop: () => void
  onRemove: () => void
  onClose: () => void
}

/** One note, opened by a press on its marker: the words, the photo, or the voice heard from where it was left. */
export function NotePanel({ app, note, playing, onPlay, onStop, onRemove, onClose }: Props) {
  return <div className="absolute inset-x-4 bottom-4 z-10 grid gap-3 rounded-xl border bg-background/95 p-4 shadow-lg">
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="outline">{KIND[note.kind]}</Badge>
      <span className="text-sm text-muted-foreground">{note.author} · {when(note.createdAt)}</span>
      <Button className="ml-auto" type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
    </div>
    {note.kind === 'text' && <p>{note.words}</p>}
    {note.kind === 'photo' && <img className="max-h-64 w-fit rounded-lg" src={mediaUrl(app, note.id)}
      alt={`Left here by ${note.author}`} />}
    <div className="flex flex-wrap items-center gap-2">
      {note.kind === 'voice' && (playing
        ? <Button type="button" variant="outline" onClick={onStop}>Stop</Button>
        : <Button type="button" onClick={onPlay}>Play from here</Button>)}
      {removable(note.id) && <Button type="button" variant="ghost" size="sm" onClick={onRemove}>Remove</Button>}
    </div>
  </div>
}
