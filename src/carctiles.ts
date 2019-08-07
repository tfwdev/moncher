import {GridTileSceneConfig, GridTileSceneModel} from "./gridtiles"
//import {vec2} from "tfw/core/math"

enum Direction {
  North,
  East,
  West,
  South
}

/**
 * A larger logical tile that is made up of 3x3 base tiles.
 */
export class CarcTile
{
  constructor (
    /** The three base tiles along the top. */
    nw :string, n :string, ne :string,
    /** The three base tiles in the middle. */
    w :string, center: string, e :string,
    /** The three base tiles along the bottom. */
    sw :string, s :string, se :string
  ) {
    this._base = [ nw, n, ne, w, center, e, sw, s, se ]
  }

  /**
   * Does this carctile match-up with the specified carctile in the specified direction?
   */
  matches (other :CarcTile, direction :Direction) :boolean {
    let dex, oDex, inc
    switch (direction) {
      case Direction.North: dex = 0; oDex = 6; inc = 1; break
      case Direction.West: dex = 0; oDex = 2; inc = 3; break
      case Direction.South: return other.matches(this, Direction.North)
      case Direction.East: return other.matches(this, Direction.West)
      default: throw new Error("Wat")
    }
    for (let ii = 0; ii < 3; ii++, dex += inc, oDex += inc) {
      if (this._base[dex] != other._base[oDex]) {
        return false
      }
    }
    return true
  }

  /**
   * Populate a grid model with this carctile at the specified location. (upper left)
   */
  populate (model :GridTileSceneModel, x :number, y :number) :void {
    for (let ii = 0; ii < 3; ii++) {
      let col = model.tiles[x + ii]
      let index = ii
      for (let jj = 0; jj < 3; jj++, index += 3) {
        col[jj + y] = this._base[index]
      }
    }
  }

  /** The base tiles of this CarcTile. */
  protected _base :Array<string>
}

/**
 * Pick a random CarcTile.
 */
function pickCarcTile (tiles :Array<CarcTile>) :CarcTile
{
  // TODO: weighted!
  return tiles[Math.trunc(Math.random() * tiles.length)]
}

function findLeastPossible (map :Map<number, Array<CarcTile>>) :number
{
  let bestSize = Number.MAX_SAFE_INTEGER
  let best = -1
  map.forEach((value, key) => {
    if (value.length < bestSize) {
      bestSize = value.length
      best = key
    }
  })
  return best
}

/**
 * Generate a GridTileSceneModel from a set of CarcTiles.
 * @param width the width in logical carctile units
 * @param height the height in logical carctile units
 */
export function generateGridModel (
  tiles :Array<CarcTile>, width :number, height :number, cfg :GridTileSceneConfig)
  :GridTileSceneModel
{
  let encode = (x :number, y :number) => x + (y * width)
  let decodeX = (encoded :number) => encoded - (Math.trunc(encoded / width) * width)
  let decodeY = (encoded :number) => Math.trunc(encoded / width)

//  let z = encode(5, 7)
//  console.log("Encoded it's " + z + ", decodeX: " + decodeX(z) + ", decodeY: " + decodeY(z))

  TRIES:
  for (let tries = 0; tries < 100; tries++) {
    let board = new Array<Array<CarcTile>>(width)
    for (let xx = 0; xx < width; xx++) {
      board[xx] = new Array<CarcTile>(height)
    }

    let possible = new Map<number, Array<CarcTile>>()
    // kick things off by making every tile possible in the very center
    possible.set(encode(Math.trunc(width / 2), Math.trunc(height / 2)), tiles.concat())

    while (possible.size) {
      let key = findLeastPossible(possible)
      let ptiles = possible.get(key)! // we know the key is in there
      possible.delete(key)
      if (ptiles.length == 0) {
        console.log("Found an impossible situation!")
        continue TRIES
      }
      // otherwise there are valid tiles, pick one!
      let keyX = decodeX(key)
      let keyY = decodeY(key)
      let pickedTile = pickCarcTile(ptiles)
      board[keyX][keyY] = pickedTile

      // see how this new pick affects the possibilities of surrounding tiles
      for (let dir of [ Direction.North, Direction.South, Direction.West, Direction.East ]) {
        let xx = keyX, yy = keyY
        switch (dir) {
          case Direction.North: yy--; break
          case Direction.South: yy++; break
          case Direction.West: xx--; break
          case Direction.East: xx++; break
        }
        if ((xx < 0) || (xx >= width)) continue
        if ((yy < 0) || (yy >= height)) continue
        if (board[xx][yy]) continue // skip it if we've already settled on the tile there
        let oKey = encode(xx, yy)
        let oPtiles = possible.get(oKey)
        if (!oPtiles) {
          // insert all tiles as possible if a newly-initialized spot
          oPtiles = tiles.concat()
          possible.set(oKey, oPtiles)
        }
        for (let index = oPtiles.length - 1; index >= 0; index--) {
          if (!pickedTile.matches(oPtiles[index], dir)) {
            oPtiles.splice(index, 1)
          }
        }
      }
    }

    // create the model to return
    let model = new GridTileSceneModel(cfg, width * 3, height * 3)
    for (let xx = 0; xx < width; xx++) {
      for (let yy = 0; yy < height; yy++) {
        if (board[xx][yy]) board[xx][yy].populate(model, xx * 3, yy * 3)
      }
    }
    return model
  }
  throw new Error("Unable to generate model from tiles")
}
