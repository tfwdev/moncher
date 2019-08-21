import {
  AnimationMixer,
//  Color,
//  Math as ThreeMath,
  Object3D,
  Quaternion,
  Raycaster,
  Vector3,
  WebGLRenderer,
} from "three"

import {Body} from "cannon"

import {Clock} from "tfw/core/clock"
import {MapChange} from "tfw/core/rcollect"
//import {log} from "tfw/core/util"
import {Hand} from "tfw/input/hand"
import {
  Component,
  DenseValueComponent,
  Domain,
  GraphSystem,
  ID,
  Matcher,
  SparseValueComponent,
  System
} from "tfw/entity/entity"
import {TransformComponent} from "tfw/space/entity"
import {AnimationSystem, HoverMap, SceneSystem} from "tfw/scene3/entity"
import {Host3} from "tfw/ui/host3"

import {registerLogicNodes} from "tfw/graph/logic"
import {registerMathNodes} from "tfw/graph/math"
import {registerUtilNodes} from "tfw/graph/util"
import {registerEntityNodes} from "tfw/entity/node"
import {registerSpaceNodes} from "tfw/space/node"
import {registerScene3Nodes} from "tfw/scene3/node"
import {registerPhysics3Nodes} from "tfw/physics3/node"
import {registerInputNodes} from "tfw/input/node"
import {registerUINodes} from "tfw/ui/node"
import {Graph} from "tfw/graph/graph"
import {NodeContext, NodeTypeRegistry} from "tfw/graph/node"

import {App, Mode} from "./app"
import {MonsterConfig, MonsterState, RanchModel} from "./moncher"
import {Hud} from "./hud"

class ActorInfo
{
  constructor (
    /** The id from the RanchModel. */
    readonly id :number,
    /** The id in the entity system. */
    readonly entityId :number,
    readonly config :MonsterConfig,
  ) {}
}

class LerpRec
{
  constructor (
    /** The source location. */
    readonly src :Vector3,
    /** The destination location. */
    readonly dest :Vector3,
    /** How long shall we take? (TODO: compute based on speed / distance?) */
    readonly duration :number,
    /** Ending timestamp (start time + duration) (filled-in by LerpSystem) */
    public stamp? :number
  ) {}
}

class LerpSystem extends System
{
  constructor (
    domain :Domain,
    readonly trans :TransformComponent,
    readonly lerp :Component<LerpRec|undefined>,
    readonly getY :(x :number, z :number) => number,
  ) {
    super(domain, Matcher.hasAllC(trans.id, lerp.id))
  }

  update (clock :Clock) {
    const pos :Vector3 = new Vector3()
    this.onEntities(id => {
      let lerpRec = this.lerp.read(id)
      if (lerpRec) {
        if (!lerpRec.stamp) {
          lerpRec.stamp = clock.time + lerpRec.duration
        }
        let timeLeft = lerpRec.stamp - clock.time
        if (timeLeft <= 0) {
          this.trans.updatePosition(id, lerpRec.dest)
          this.lerp.update(id, undefined)
        } else {
          pos.lerpVectors(lerpRec.dest, lerpRec.src, timeLeft / lerpRec.duration)
          // but override the Y value according to terrain?
          pos.y = this.getY(pos.x, pos.z)
          this.trans.updatePosition(id, pos)
        }
      }
    })
  }
}

export class RanchMode extends Mode
{
  constructor (
    app :App,
    protected _ranch :RanchModel,
  ) {
    super()
    this.configureScene(app)

    this.onDispose.add(_ranch.monsters.onChange(this._monsterChange))
    _ranch.monsters.forEach((monster, id) => { this.updateMonster(id, monster) })

    new Hud(this._host, app.renderer)
  }

  protected configureScene (app :App) :void {
    const webGlRenderer = this._webGlRenderer = new WebGLRenderer()
    webGlRenderer.gammaOutput = true
    webGlRenderer.gammaFactor = 2.2
    this.onDispose.add(webGlRenderer)

    // replace the 2d canvas
    const root = app.renderer.canvas.parentElement as HTMLElement
    root.removeChild(app.renderer.canvas)
    root.appendChild(webGlRenderer.domElement)
    this.onDispose.add(app.renderer.size.onValue(size => {
      webGlRenderer.setPixelRatio(window.devicePixelRatio)
      webGlRenderer.setSize(size[0], size[1])
    }))
    // set up a dispose to restore the 2d canvas
    this.onDispose.add(() => {
      root.removeChild(webGlRenderer.domElement)
      root.appendChild(app.renderer.canvas)
    })

    const host = this._host = new Host3()
    this.onDispose.add(host.bind(webGlRenderer.domElement))
    this.onDispose.add(host)

    const hand = this._hand = new Hand(webGlRenderer.domElement)
    this.onDispose.add(hand)

    // TODO: what is the minimum we need?
    const nodeCtx :NodeContext = {
      types: new NodeTypeRegistry(
        registerLogicNodes,
        registerMathNodes,
        registerUtilNodes,
        registerEntityNodes,
        registerSpaceNodes,
        registerScene3Nodes,
        registerPhysics3Nodes,
        registerInputNodes,
        registerUINodes,
      ),
      hand,
      host,
    }

    const trans = this._trans = new TransformComponent("trans")
    const obj = this._obj = new DenseValueComponent<Object3D>("obj", new Object3D())
    const mixer = new DenseValueComponent<AnimationMixer>("mixer",
        new AnimationMixer(new Object3D()))
    const body = new DenseValueComponent<Body>("body", new Body())
    const hovers = new SparseValueComponent<HoverMap>("hovers", new Map())
    const lerp = this._lerp = new SparseValueComponent<LerpRec|undefined>("lerp", undefined)
    const graph = new DenseValueComponent<Graph>("graph", new Graph(nodeCtx, {}))

    const domain = this._domain = new Domain({}, {trans, obj, mixer, body, lerp, hovers, graph})
    /*const lerpsys =*/ this._lerpsys = new LerpSystem(domain, trans, lerp, this.getY.bind(this))
    const scenesys = this._scenesys = new SceneSystem(
        domain, trans, obj, hovers, hand.pointers)
    /*const graphsys =*/ this._graphsys = new GraphSystem(nodeCtx, domain, graph)
    scenesys.scene.add(host.group)

    /*const animsys =*/ this._animsys = new AnimationSystem(domain, obj, mixer)

    // add lights and camera
    const CAMERA_MOVEMENT_FACTOR = 80 // Hacky multiplication factor so we get noticeable movement
    const cameraId = domain.add({
      components: {
        trans: {initial: new Float32Array([0, RanchMode.CAMERA_HEIGHT, 12, 0, 0, 0, 1, 1, 1, 1])},
        obj: {type: "perspectiveCamera"},
        hovers: {},
        graph: {
          hover: {type: "hover", component: "hovers"},
          viewMovement: {type: "Vector3.split", input: ["hover", "viewMovement"]},
          xDelta: {type: "multiply",
              inputs: [["hover", "pressed"], ["viewMovement", "x"], -CAMERA_MOVEMENT_FACTOR]},
          yDelta: {type: "multiply",
              inputs: [["hover", "pressed"], ["viewMovement", "y"], CAMERA_MOVEMENT_FACTOR]},
          leftRight: {type: "accumulate", input: "xDelta"},
          upDown: {type: "accumulate", input: "yDelta"},
          panning: {type: "Vector3",
              x: "leftRight", y: RanchMode.CAMERA_HEIGHT, z: "upDown"},
          updatePosition: {type: "updatePosition", component: "trans", input: "panning"}
        },
      },
    })
    trans.updateQuaternion(cameraId, new Quaternion().setFromAxisAngle(
        new Vector3(1, 0, 0), -Math.PI/3))
    domain.add({
      components: {
        trans: {},
        obj: {type: "ambientLight", color: 0x202020},
      },
    })
    domain.add({
      components: {
        trans: {initial: new Float32Array([1, 1, 1, 0, 0, 0, 1, 1, 1, 1])},
        obj: {type: "directionalLight"},
      },
    })

    // add the ranch terrain
    const ranchTerrainId = this._terrainId = domain.add({
      components: {
        trans: {},
        obj: {type: "gltf", url: "ranch/Ranch.glb"}, // Contains a "NavMesh" object. TODO
      },
    })
    trans.updateScale(ranchTerrainId, new Vector3(.5, .5, .5))
  }

  render (clock :Clock) :void {
    this._hand.update()
    this._host.update(clock)
    this._lerpsys.update(clock)
    this._animsys.update(clock)
    this._scenesys.update()
    this._scenesys.render(this._webGlRenderer)
  }

  /**
   * React to a monster being added to the ranch model.
   */
  protected updateMonster (id :number, state :MonsterState) :void {
    // see if we've given this monster an entity ID yet
    let actorInfo = this._monsters.get(id)
    if (!actorInfo) {
      const cfg = this._ranch.monsterConfig.get(id)
      if (!cfg) {
        throw new Error("Monster doesn't have a config in the RanchModel")
      }
      if (!cfg.model) {
        throw new Error("Monster doesn't have 3d model configuration")
      }
      const entityId = this._domain.add({
        components: {
          trans: {initial: new Float32Array([state.x, this.getY(state.x, -state.y), -state.y,
              0, 0, 0, 1, 1, 1, 1])},
          obj: {type: "gltf", url: cfg.model.model},
          mixer: {},
          lerp: {},
        },
      })
      actorInfo = new ActorInfo(id, entityId, cfg)
      this._monsters.set(id, actorInfo)
    }

    this.updateMonsterActor(actorInfo, state)
  }

  /**
   * Effect updates received from the RanchModel.
   */
  protected updateMonsterActor (actorInfo :ActorInfo, state :MonsterState) :void {
    // see if they already have a lerpRec to this pos
    const pos = new Vector3(state.x, this.getY(state.x, -state.y), -state.y)
    const oldRec = this._lerp.read(actorInfo.entityId)
    if (oldRec && oldRec.dest.equals(pos)) return

    const oldPos = this._trans.readPosition(actorInfo.entityId, new Vector3())
    const rec = new LerpRec(oldPos, pos, RanchMode.MONSTER_MOVE_DURATION)
    this._lerp.update(actorInfo.entityId, rec)
//    log.debug("updating monster to : " + pos)
  }

  /**
   * React to a monster being removed from the ranch model.
   */
  protected deleteMonster (id :number) :void {
    const actorInfo = this._monsters.get(id)
    if (!actorInfo) return
    this._monsters.delete(id)
    this._domain.delete(actorInfo.entityId)
  }

  protected getY (x :number, z :number) :number
  {
    let terrain = this._obj.read(this._terrainId)
    if (terrain) {
      const HAWK_HEIGHT = 10
      let caster = new Raycaster(new Vector3(x, HAWK_HEIGHT, z), new Vector3(0, -1, 0))
      let results = caster.intersectObject(terrain, true)
      for (let result of results) {
        return HAWK_HEIGHT - result.distance
      }
    }
    return 2.5 // bogus fallback height
  }

  // The properties below are all definitely initialized via the constructor
  protected _host! :Host3
  protected _webGlRenderer! :WebGLRenderer
  protected _hand! :Hand
  protected _trans! :TransformComponent
  protected _obj! :Component<Object3D>
  protected _lerp! :Component<LerpRec|undefined>
  protected _graphsys! :GraphSystem
  protected _lerpsys! :LerpSystem
  protected _scenesys! :SceneSystem
  protected _animsys! :AnimationSystem
  protected _domain! :Domain

  protected _terrainId! :ID

  protected readonly _monsters :Map<number, ActorInfo> = new Map()

  protected readonly _monsterChange = (change :MapChange<number, MonsterState>) => {
    if (change.type === "set") {
      this.updateMonster(change.key, change.value)
    } else {
      this.deleteMonster(change.key)
    }
  }

  private static MONSTER_MOVE_DURATION = 1200
  private static CAMERA_HEIGHT = 30
}