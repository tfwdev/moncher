import {Disposable, Disposer, Remover} from "tfw/core/util"
import {UUID} from "tfw/core/uuid"
import {Mutable, Value} from "tfw/core/react"
import {Action, Spec} from "tfw/ui/model"
import {LabelStyle} from "tfw/ui/text"
import {BoxStyle} from "tfw/ui/box"
import {Insets} from "tfw/ui/style"
import {ElementConfig, Host} from "tfw/ui/element"
import {Model, ModelData, makeProvider} from "tfw/ui/model"

import {RanchObject} from "./data"
import {App} from "./app"

function mergeExtra<T extends Object> (config :T, extra? :Object) :T {
  // TODO: deal with all the inevitable edge cases
  if (extra) {
    for (const key in extra) {
      const value = extra[key];
      if (typeof value === "object") config[key] = mergeExtra(config[key] || {}, value)
      else config[key] = value
    }
  }
  return config
}

export function label (text :Spec<Value<string>>, style? :LabelStyle, extra? :Object) {
  return mergeExtra({type: "label", text, style}, extra)
}

export function box (contents :Object, style? :BoxStyle) {
  return {type: "box", contents, style}
}

export function textBox (text :Spec<Mutable<string>>, onEnter :Spec<Action>, extra? :Object) {
  const config = {type: "text", text, onEnter, contents: box(label(text), {halign: "left"})}
  return mergeExtra(config, extra)
}

export function button (text :Spec<Value<string>>, onClick :Spec<Action>,
                        style? :LabelStyle, extra? :Object) {
  return mergeExtra({type: "button", onClick, contents: box(label(text, style))}, extra)
}

const closeX = Value.constant("×")

export function closeButton (onClick :Spec<Action>, extra? :Object) {
  return mergeExtra({type: "button", onClick, contents: box(label(closeX), {
    padding: [4, 8, 4, 8],
  })}, extra)
}

const Check = "✔︎"
const checkCircle = box({type: "label", text: Value.constant(Check)},
                        {border: "$checkBox", padding: [3, 5, 0, 5]})
const emptyCircle = box({type: "label", text: Value.constant(" ")},
                        {border: "$checkBox", padding: [3, 8, 0, 7]})

export function checkBox (checked :Spec<Value<boolean>>, onClick :Spec<Action>) {
  return {type: "toggle", checked, onClick, contents: emptyCircle, checkedContents: checkCircle}
}

const sausageCorner = 12

type Pos = "top" | "left" | "right" | "bottom" | "center"

export function createDialog (app :App, host :Host, title :string, contents :ElementConfig[],
                              data :ModelData, pos :Pos = "center") :Remover {
  const margin :Insets = [0, 0, 0, 0]
  switch (pos) {
  case "top": margin[0] = 20 ; break
  case "left": margin[3] = 20 ; break
  case "right": margin[1] = 20 ; break
  case "bottom": margin[2] = 20 ; break
  }

  const config = box({
    type: "column",
    offPolicy: "stretch",
    gap: 10,
    contents: [{
      type: "row",
      gap: 10,
      contents: [
        label(Value.constant(title), {font: "$header"}, {constraints: {stretch: true}}),
        closeButton("closeDialog")
      ]
    }, ...contents]
  }, {
    padding: 10,
    margin,
    background: {fill: "$orange", cornerRadius: sausageCorner},
  })

  const disposer = new Disposer()
  const closeDialog = () => disposer.dispose()

  const root = app.ui.createRoot({
    type: "root",
    scale: app.renderer.scale,
    autoSize: true,
    hintSize: app.renderer.size,
    // TODO: allow subclass to specify?
    // minSize: Value.constant(dim2.fromValues(300, 0)),
    contents: config,
  }, new Model({...data, closeDialog}))
  disposer.add(() => host.removeRoot(root))

  switch (pos) {
  case    "top": root.bindOrigin(app.renderer.size, "center", "top", "center", "top") ; break
  case   "left": root.bindOrigin(app.renderer.size, "left", "center", "left", "center") ; break
  case "bottom": root.bindOrigin(app.renderer.size, "center", "bottom", "center", "bottom") ; break
  case  "right": root.bindOrigin(app.renderer.size, "right", "center", "right", "center") ; break
  case "center": root.bindOrigin(app.renderer.size, "center", "center", "center", "center") ; break
  }
  host.addRoot(root)

  return closeDialog
}

// from https://stackoverflow.com/questions/21741841
function getMobileOperatingSystem () {
  const userAgent = navigator.userAgent
  // Windows Phone must come first because its UA also contains "Android"
  if (/windows phone/i.test(userAgent)) return "windows_phone"
  if (/android/i.test(userAgent)) return "android"
  // iOS detection from: https://stackoverflow.com/a/9039885/177710
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return "ios"
  return "unknown"
}

function getAppURL () {
  switch (getMobileOperatingSystem()) {
  case "android": return "https://play.google.com/apps/testing/dev.tfw.chatapp"
  case "ios": return "https://tfw.dev/app.html" // TODO: real URL when we have one
  default: return "https://tfw.dev/app.html"
  }
}

function showGetApp (app :App) :Value<boolean> {
  // only show get the app if we're not a guest but we have no notification tokens (which either
  // means we've never installed the app or we refused to allow it to send us notifications; so this
  // is not perfect, but it'll have to do for now)
  const tokens = app.user.userValue.switchMap(
    user => user ? user.tokens.sizeValue : Value.constant(0))
  return Value.join2(app.notGuest, tokens).map(([ng, toks]) => ng && toks === 0)
}

const installAppUI = {
  type: "box",
  style: {
    margin: 5,
  },
  contents: {
    type: "button",
    onClick: "openAppPage",
    contents: {
      type: "box",
      contents: {
        type: "row",
        contents: [{
          type: "image",
          width: 40,
          height: 40,
          image: Value.constant("ui/app@2x.png"),
        }, {
          type: "column",
          contents: [
            label(Value.constant("Get the")),
            label(Value.constant("chat app!")),
          ]
        }]
      }
    },
  },
}

export class InstallAppView implements Disposable {
  private _onDispose = new Disposer()

  constructor (readonly app :App, host :Host) {
    const root = app.ui.createRoot({
      type: "root",
      scale: app.renderer.scale,
      autoSize: true,
      contents: installAppUI,
      visible: showGetApp(app),
    }, new Model({
      openAppPage: () => window.open(getAppURL())
    }))
    root.bindOrigin(app.renderer.size, "left", "top", "left", "top")
    host.addRoot(root)
    this._onDispose.add(() => host.removeRoot(root))
  }

  dispose () {
    this._onDispose.dispose()
  }
}

const occupantsUI = {
  type: "box",
  style: {
    margin: 5,
  },
  contents: {
    type: "hlist",
    gap: 5,
    keys: "occkeys",
    data: "occdata",
    element: {
      // TODO: tooltip with person's name...
      type: "image",
      image: "photo",
      height: 20,
    },
  },
}

export class OccupantsView implements Disposable {
  private _onDispose = new Disposer()

  constructor (readonly app :App, host :Host) {
    const [ranch, unranch] = app.client.resolve(["ranches", app.state.ranchId], RanchObject)
    this._onDispose.add(unranch)
    const root = app.ui.createRoot({
      type: "root",
      scale: app.renderer.scale,
      autoSize: true,
      contents: occupantsUI,
      visible: showGetApp(app).map(s => !s),
    }, new Model({
      occkeys: ranch.occupants.map(Array.from),
      occdata: makeProvider<UUID>(key => {
        const profile = app.profiles.profile(key)
        return {name: profile.name, photo: profile.photo}
      }),
    }))
    root.bindOrigin(app.renderer.size, "left", "top", "left", "top")
    host.addRoot(root)
    this._onDispose.add(() => host.removeRoot(root))
  }

  dispose () {
    this._onDispose.dispose()
  }
}
