import {Clock} from "tfw/core/clock"
import {vec2} from "tfw/core/math"
import {Subject} from "tfw/core/react"
import {MapChange, MutableMap, RMap} from "tfw/core/rcollect"
import {Disposer} from "tfw/core/util"
import {Texture, Tile} from "tfw/scene2/gl"
import {Surface} from "tfw/scene2/surface"
import {App} from "./app"
import {GridTileSceneModel, GridTileSceneViewMode, PropTileInfo} from "./gridtiles"

/**
 * Configuration of a monster.
 */
export class MonsterConfig
{
  constructor (
    /** What the monster looks like, can be a shared object between multiple monsters. */
    readonly info :PropTileInfo
  ) {}
}

/**
 * Runtime information about a monster's visual state.
 */
export class MonsterVisualState
{
  constructor (
    readonly x :number,
    readonly y :number,
    readonly state :string // TODO: walking, eating, pooping, mating...
  ) {}

  /**
   * Compares two MonsterVisualState's for equality.
   */
  static eq (a :MonsterVisualState, b :MonsterVisualState) :boolean
  {
    return (a.x === b.x) && (a.y === b.y) && (a.state === b.state)
  }
}


/**
 * Secret internal monster data.
 */
class MonsterData
{
  public hunger :number = 0
  public lonliness :number = 0
  public boredom :number = 0
  public crowding :number = 0
  /** Recently visited locations, most recent at index 0. */
  public locationMemory :Array<vec2> = new Array<vec2>()
  public state :string = ""

  constructor (
    readonly id :number,
    readonly config :MonsterConfig,
    public x :number,
    public y :number
  ) {}

  public toVisualState () :MonsterVisualState
  {
    return new MonsterVisualState(this.x, this.y, this.state)
  }

  public rememberLocation (x :number, y :number) :void
  {
    const newLoc = vec2.fromValues(x, y)
    const index = this.getMemoryIndex(newLoc)
    if (index !== -1) {
      // splice it out of the old location
      this.locationMemory.splice(index, 1)

    } else if (this.locationMemory.length === MonsterData.MEMORY_SIZE) {
      // if we're already at the size, make room for the new location
      this.locationMemory.pop()
    }

    // always add the new location to the front
    this.locationMemory.unshift(newLoc)
  }

  public isInMemory (loc :vec2) :boolean
  {
    return this.getMemoryIndex(loc) > -1
  }

  protected getMemoryIndex (loc :vec2) :number
  {
    return this.locationMemory.findIndex(v => vec2.equals(loc, v))
  }

  /** How much memory to keep. */
  protected static readonly MEMORY_SIZE = 10
}

export class RanchModel
{
  /** The public view of monster state. */
  public monsters :RMap<number, MonsterVisualState>

  /** The configuration data for a monster, guaranteed to be populated prior to
   *  'monsters' being updated. */
  public monsterConfig :Map<number, MonsterConfig> = new Map<number, MonsterConfig>()

  constructor (
    /** The model we're on. */
    public readonly model :GridTileSceneModel
  ) {
    this.monsters = this._monsters = MutableMap.local()
  }

  /**
   * Add a new monster.
   */
  public addMonster (config :MonsterConfig, x :number, y :number) :void
  {
    const id = this._nextMonsterId++
    const data = new MonsterData(id, config, x, y)
    this.monsterConfig.set(id, config)
    this._monsterData.set(id, data)
    this._monsters.set(id, data.toVisualState())
  }

  /**
   * Advance the simulation.
   */
  public tick () :void
  {
    for (const monst of this._monsterData.values()) {
      // TODO: do this well, somehow
      monst.x += .2
      monst.y += .2
      this._monsters.set(monst.id, monst.toVisualState())
    }
  }

  protected _nextMonsterId :number = 0
  protected _monsterData :Map<number, MonsterData> = new Map<number, MonsterData>()
  /** A mutable view of our public monsters RMap. */
  protected _monsters :MutableMap<number, MonsterVisualState>
}

class MonsterSprite
{
  /** The tile for drawing the monster. */
  public tile? :Tile
  /** Position. */
  public pos :vec2 = vec2.create()
  /** A disposer just for this sprite. */
  public disposer :Disposer = new Disposer()

  constructor (
    /** The most recent state. */
    public state :MonsterVisualState
  ) {}
}

export class MonsterRancherMode extends GridTileSceneViewMode {
  constructor (
    app :App,
    protected _ranch :RanchModel
  ) {
    super(app, _ranch.model)

    this.onDispose.add(_ranch.monsters.onChange(this._monsterChange))
    _ranch.monsters.forEach((monster, id) => { this.updateMonster(id, monster) })
  }

  /**
   * Update a monster sprite.
   */
  protected updateMonsterSprite (sprite :MonsterSprite, state :MonsterVisualState)
  {
    sprite.state = state // just copy the latest state in
    let xx = state.x * this._model.config.tileWidth
    let yy = state.y * this._model.config.tileHeight
    if (sprite.tile) {
      xx -= sprite.tile.size[0] / 2
      yy -= sprite.tile.size[1] / 2
    }
    vec2.set(sprite.pos, xx, yy)
  }

  protected drawActors (clock :Clock, surf :Surface) :void
  {
    super.drawActors(clock, surf)
    // draw monsters
    for (const monst of this._monsters.values()) {
      if (monst.tile) {
        surf.drawAt(monst.tile, monst.pos)
      }
    }
  }

  protected updateMonster (id :number, state :MonsterVisualState)
  {
    let sprite = this._monsters.get(id)
    if (!sprite) {
      // async lookup tile
      const cfg = this._ranch.monsterConfig.get(id)
      if (!cfg) {
        throw new Error("Monster doesn't have a config in the model")
      }

      sprite = new MonsterSprite(state)
      this._monsters.set(id, sprite)
      this.onDispose.add(sprite.disposer)
      const img :Subject<Texture> = this.getTexture(cfg.info.base)
      const remover = img.onValue(tex => {
        sprite!.tile = tex
        // let's just call into updateMonsterSprite to rejiggle the location
        this.updateMonsterSprite(sprite!, sprite!.state)
      })
      sprite.disposer.add(remover)
    }
    this.updateMonsterSprite(sprite, state)
  }

  protected deleteMonster (id :number)
  {
    const sprite = this._monsters.get(id)
    if (!sprite) return
    this._monsters.delete(id)
    this.onDispose.remove(sprite.disposer)
    sprite.disposer.dispose()
  }

  protected readonly _monsterChange = (change :MapChange<number, MonsterVisualState>) => {
    if (change.type === "set") {
      this.updateMonster(change.key, change.value)
    } else {
      this.deleteMonster(change.key)
    }
  }

  protected readonly _monsters :Map<number, MonsterSprite> = new Map()
}
