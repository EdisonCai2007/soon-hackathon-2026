import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/archivo/900.css'
import '@fontsource/arimo/400.css'
import { useNavigate, useParams } from 'react-router'
import { StartRoom } from './Host'
import { arrivalFrom } from './invite'
import { Phone } from './Phone'
import { Room } from './Room'
import { Scan } from './Scan'

// ROAM: the real room scan, walkable in the page, and shared with whoever has the link. The scan and its
// details are this app's static files in app/public/apps/roam/, made by scripts/roam-ply-to-spz.mjs.
export function App() {
  const params = useParams()
  const app = params.name!
  const arrival = arrivalFrom(params['*'])
  const navigate = useNavigate()

  if (arrival.kind === 'camera') return <Phone app={app} roomId={arrival.roomId} />
  if (arrival.kind === 'guest') return <Room app={app} roomId={arrival.roomId} />
  return <Scan app={app} before={<StartRoom app={app} onStarted={(roomId) => void navigate(`/apps/${app}/r/${roomId}`)} />} />
}
