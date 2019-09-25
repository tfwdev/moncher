import {UUID} from "tfw/core/uuid"
import {Mutable, Value} from "tfw/core/react"
import {Host} from "tfw/ui/element"
import {showGoogleLogin} from "tfw/auth/firebase"

import {App} from "./app"
import {label, button, createDialog} from "./ui"

function makeInviteUrl (app :App, ranchId :UUID, eggId :UUID) :string {
  const {protocol, host} = window.location
  return `${protocol}//${host}${app.state.appPath}${ranchId}+${eggId}`
}

export function showEggInvite (app :App, host :Host, ranchId :UUID, eggId :UUID) {
  const status = Mutable.local("Click the URL to copy it to the clipboard.")
  const inviteUrl = makeInviteUrl(app, ranchId, eggId)
  return createDialog(app, host, "Put this egg up for adoption!", [
    label(Value.constant("Send this URL to a friend and they can adopt this egg:")),
    button("inviteUrl", "copyInviteUrl"),
    label("status"),
  ], {
    inviteUrl: Value.constant(inviteUrl),
    copyInviteUrl: () => navigator.clipboard.writeText(inviteUrl).then(
      _ => status.update("URL copied to clipboard. Paste like the wind!"),
      error => status.update(`Failed to copy URL to clipboard: ${error}`)
    ),
    status,
  })
}

export function showEggAuth (app :App, host :Host) {
  const close = createDialog(app, host, "Log in to adopt this egg!", [
    button(Value.constant("Login with Google"), "loginGoogle")
  ], {
    loginGoogle: () => showGoogleLogin(),
  })
  app.notGuest.whenOnce(ng => ng === true, _ => close())
}