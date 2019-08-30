import {MutableMap, RMap} from "tfw/core/rcollect"

/**
 * The kind of actor.
 */
export class ActorKind
{
  // Big fat TODO...
  static readonly EGG :ActorKind = new ActorKind(false, false, false, 0)
  static readonly FOOD :ActorKind = new ActorKind(false, false, false, 0)
  static readonly RUNNER :ActorKind = new ActorKind(true, false, false)
  static readonly HEALER :ActorKind = new ActorKind(false, true, true)
  static readonly LOBBER :ActorKind = new ActorKind(true, false, false)
  static readonly TESTER :ActorKind = new ActorKind(true, true, true)

  private constructor (
    readonly canRangeAttack :boolean,
    readonly canMeleeAttack :boolean,
    readonly canHeal :boolean,
    readonly maxSpeed :number = .025 // units per second
  ) {}
}

/**
 * Configuration for the 3D aspects of an actor. This will probably move.
 */
export interface ActorModel {
  model :string
  /** Idle animation. */
  idle? :string
  /** Eggs use the hatch animation at the end of their lives, other actors at the beginning. */
  hatch? :string
  walk? :string
  attack? :string
  hitReact? :string
  faint? :string
  sleep?: string
  wakeUp?: string
}

/**
 * Configuration of an actor.
 */
export class ActorConfig
{
  constructor (
    /** What the actor looks like in 2D. */
    readonly kind :ActorKind = ActorKind.TESTER,
    readonly model? :ActorModel,
    readonly spawn? :ActorConfig,
    readonly startingHealth :number = 50,
    readonly maximumHealth :number = 50,
    readonly startingActionPts :number = 5,
    readonly maxActionPts :number = 10,
    readonly regenActionPts :number = .2,
  ) {}
}

export enum ActorAction {
  None,
  Hatching,
}

/**
 * Runtime information about an actor's state.
 */
export class ActorState
{
  constructor (
    /** Visual X coordinate (tile coordinates, floating point). */
    readonly x :number,
    /** Visual Y coordinate (tile coordinates, floating point). */
    readonly y :number,
    /** TODO */
    readonly action :ActorAction,
  ) {}

  // Legacy // TODO: Remove
  get actionPts () :number
  {
    return 20
  }
}

/**
 * An actor.
 */
abstract class Actor
{
  /** All actors have health. */
  health :number

  constructor (
    readonly id :number,
    readonly config :ActorConfig,
    public x :number,
    public y :number,
    public action :ActorAction,
  ) {
    this.health = config.startingHealth
    this.postConstruct()
  }

  /**
   * Additional constructor logic for subclasses without having to reimpl the constructor. */
  protected postConstruct () :void
  {
  }

  isMobile () :boolean
  {
    switch (this.config.kind) {
      case ActorKind.EGG: return false
      case ActorKind.FOOD: return false
      default: return (this.action !== ActorAction.Hatching)
    }
  }

  abstract tick (model :RanchModel) :void

  toState () :ActorState
  {
    return new ActorState(this.x, this.y, this.action)
  }

  setLocation (x :number, y :number) :void
  {
    this.x = x
    this.y = y
  }

  moveTowards (x :number, y :number) :void
  {
  }
}

class Egg extends Actor
{
  protected postConstruct () :void {
    // force health because we're going to do modify it in tick
    this.health = 50
  }

  tick (model :RanchModel) :void {
    this.health -= 1
    if (this.action === ActorAction.None && (this.health < 20)) {
      this.action = ActorAction.Hatching
      model.addActor(this.config.spawn!, this.x, this.y, ActorAction.Hatching)
    }
  }
}

class Monster extends Actor
{
  tick (model :RanchModel) :void {
    // TODO!
  }
}

class Food extends Actor
{
  tick (model :RanchModel) :void {
    this.health -= .01
  }
}

export class RanchModel
{
  /** The public view of monster state. */
  get actors () :RMap<number, ActorState> {
    return this._actors
  }

  /** The configuration data for an actor, guaranteed to be populated prior to
   *  'actors' being updated. */
  readonly actorConfig :Map<number, ActorConfig> = new Map<number, ActorConfig>()

  /**
   * Le constructor. */
  constructor (
  ) {
  }

  addActor (config :ActorConfig, x :number, y :number, action = ActorAction.None) :void
  {
    this.validateConfig(config)

    const id = this._nextActorId++
    const clazz = this.pickActorClass(config)
    const data = new clazz(id, config, x, y, action)
    this.actorConfig.set(id, config)
    this._actorData.set(id, data)
    // finally, publish the state of the monster
    this._actors.set(data.id, data.toState())
  }

  protected validateConfig (config :ActorConfig)
  {
    switch (config.kind) {
      case ActorKind.EGG:
        if (!config.spawn) {
          throw new Error("Eggs must specify a spawn config.")
        }
        // validate the spawn too
        this.validateConfig(config.spawn)
        break
    }
  }

  protected pickActorClass (config :ActorConfig) :{ new (...args: any[]): Actor}
  {
    switch (config.kind) {
      case ActorKind.EGG: return Egg
      case ActorKind.FOOD: return Food
      default: return Monster
    }
  }

  protected removeActor (data :Actor)
  {
    this._actorData.delete(data.id)
    this._actors.delete(data.id)
    // unmap the config last in the reverse of how we started
    this.actorConfig.delete(data.id)
  }

  getNearbyActors (x :number, y :number, maxDist :number = Math.sqrt(2)) :Actor[]
  {
    // TODO
    return []
  }

  /**
   * Advance the simulation.
   */
  tick () :void
  {
    for (const actor of this._actorData.values()) {
      actor.tick(this)
    }

    // publish all changes..
    for (const actor of this._actorData.values()) {
      if (actor.health <= 0) {
        this.removeActor(actor)
      } else {
        this._actors.set(actor.id, actor.toState())
      }
    }
  }

  protected _nextActorId :number = 0
  protected readonly _actorData :Map<number, Actor> = new Map()
  /** A mutable view of our public actors RMap. */
  protected readonly _actors :MutableMap<number, ActorState> = MutableMap.local()
}
