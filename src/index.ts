import {App} from "./app"
import {GridTileInfo, GridTileSceneConfig, GridTileSceneModel, GridTileSceneViewMode} from "./gridtiles"
import {FringeConfig} from "./fringer"
import * as Fringer from "./fringer"
import {CarcTile, generateGridModel} from "./carctiles"

const root = document.getElementById("root")
if (!root) throw new Error(`No root?`)

const app = new App(root)
app.start()

const fringeConfig :FringeConfig = [
  Fringer.SOUTHEAST, // 1, according to Rick's legend
  Fringer.SOUTHERN,  // 2
  Fringer.SOUTHWEST, // 3
  Fringer.EASTERN,
  Fringer.WESTERN,
  Fringer.NORTHEAST,
  Fringer.NORTHERN,
  Fringer.NORTHWEST,
  Fringer.WESTERN | Fringer.NORTHERN, // 9
  Fringer.WESTERN | Fringer.SOUTHERN | Fringer.EASTERN, // 10
  Fringer.EASTERN | Fringer.NORTHERN, // 11
  Fringer.NORTHERN | Fringer.EASTERN | Fringer.SOUTHERN,
  Fringer.NORTHERN | Fringer.WESTERN | Fringer.SOUTHERN,
  Fringer.WESTERN | Fringer.SOUTHERN,
  Fringer.NORTHERN | Fringer.EASTERN | Fringer.WESTERN,
  Fringer.EASTERN | Fringer.SOUTHERN // 16
]

const dirt = "dirt"
const grass = "grass"
const cobble = "cobble"
const gridConfig :GridTileSceneConfig = {
  width: 40,
  height: 40,
  scale: 2,
  tiles: [
    new GridTileInfo(dirt, "tiles/dirt.png", 0, "tiles/dirt_fringe.png"),
    new GridTileInfo(grass, "tiles/grass.png", 1, "tiles/grass_fringe.png"),
    new GridTileInfo(cobble, "tiles/cobble.png", -1, "tiles/cobble_fringe.png"),
  ],
  fringeConfig: fringeConfig,
}

const roadN = new CarcTile(dirt, cobble, dirt,
                           dirt, cobble, dirt,
                           dirt, dirt, dirt, .01)
const roadS = new CarcTile(dirt, dirt, dirt,
                           dirt, cobble, dirt,
                           dirt, cobble, dirt, .01)
const roadE = new CarcTile(dirt, dirt, dirt,
                           dirt, cobble, cobble,
                           dirt, dirt, dirt, .01)
const roadW = new CarcTile(dirt, dirt, dirt,
                           cobble, cobble, dirt,
                           dirt, dirt, dirt, .01)
const roadNS = new CarcTile(dirt, cobble, dirt,
                            dirt, cobble, dirt,
                            dirt, cobble, dirt)
const roadEW = new CarcTile(dirt, dirt, dirt,
                            cobble, cobble, cobble,
                            dirt, dirt, dirt)
const roadNW = new CarcTile(dirt, cobble, dirt,
                            cobble, cobble, dirt,
                            dirt, dirt, dirt)
const roadNE = new CarcTile(dirt, cobble, dirt,
                            dirt, cobble, cobble,
                            dirt, dirt, dirt)
const roadSE = new CarcTile(dirt, dirt, dirt,
                            dirt, cobble, cobble,
                            dirt, cobble, dirt)
const roadSW = new CarcTile(dirt, dirt, dirt,
                            cobble, cobble, dirt,
                            dirt, cobble, dirt)
const roadNEW = new CarcTile(dirt, cobble, dirt,
                             cobble, cobble, cobble,
                             dirt, dirt, dirt, .5)
const roadSEW = new CarcTile(dirt, dirt, dirt,
                             cobble, cobble, cobble,
                             dirt, cobble, dirt, .5)
const roadNWS = new CarcTile(dirt, cobble, dirt,
                             cobble, cobble, dirt,
                             dirt, cobble, dirt, .5)
// skip roadNES to give our map ~personality~
const dirtNEWS = new CarcTile(dirt, dirt, dirt,
                              dirt, dirt, dirt,
                              dirt, dirt, dirt, 5)
const grassNEWS = new CarcTile(grass, grass, grass,
                               grass, grass, grass,
                               grass, grass, grass, 5)
const grassN = new CarcTile(grass, grass, grass,
                            grass, grass, grass,
                            dirt, dirt, dirt)
const grassS = new CarcTile(dirt, dirt, dirt,
                            grass, grass, grass,
                            grass, grass, grass)
const grassW = new CarcTile(grass, grass, dirt,
                            grass, grass, dirt,
                            grass, grass, dirt)
const grassE = new CarcTile(dirt, grass, grass,
                            dirt, grass, grass,
                            dirt, grass, grass)
const grassNW = new CarcTile(grass, grass, dirt,
                             grass, grass, dirt,
                             dirt, dirt, dirt)
const grassNE = new CarcTile(dirt, grass, grass,
                             dirt, grass, grass,
                             dirt, dirt, dirt)
const grassSW = new CarcTile(dirt, dirt, dirt,
                             grass, grass, dirt,
                             grass, grass, dirt)
const grassSE = new CarcTile(dirt, dirt, dirt,
                             dirt, grass, grass,
                             dirt, grass, grass)
const grassRoadNS = new CarcTile(grass, cobble, grass,
                                 grass, cobble, grass,
                                 grass, cobble, grass)
const grassRoadN = new CarcTile(grass, cobble, grass,
                                grass, cobble, grass,
                                dirt, cobble, dirt)
const grassRoadS = new CarcTile(dirt, cobble, dirt,
                                grass, cobble, grass,
                                grass, cobble, grass)
const grassRoadEW = new CarcTile(grass, grass, grass,
                                 cobble, cobble, cobble,
                                 grass, grass, grass)
const grassRoadE = new CarcTile(dirt, grass, grass,
                                cobble, cobble, cobble,
                                dirt, grass, grass)
const grassRoadW = new CarcTile(grass, grass, dirt,
                                cobble, cobble, cobble,
                                grass, grass, dirt)
const grassRoadNW = new CarcTile(grass, cobble, grass,
                                 cobble, cobble, grass,
                                 grass, grass, grass)
const grassRoadNE = new CarcTile(grass, cobble, grass,
                                 grass, cobble, cobble,
                                 grass, grass, grass)
const grassRoadSE = new CarcTile(grass, grass, grass,
                                 grass, cobble, cobble,
                                 grass, cobble, grass)
const grassRoadSW = new CarcTile(grass, grass, grass,
                                 cobble, cobble, grass,
                                 grass, cobble, grass)
const grassRoadNEWS = new CarcTile(grass, cobble, grass,
                                   cobble, cobble, cobble,
                                   grass, cobble, grass)

let tiles = [ roadN, roadS, roadE, roadW,
              roadNS, roadEW,
              roadNW, roadNE, roadSE, roadSW,
              roadNEW, roadSEW, roadNWS, /*roadNES,*/
              dirtNEWS, grassNEWS,
              grassN, grassE, grassW, grassS,
              grassNE, grassNW, grassSE, grassSW,
              grassRoadNS, grassRoadN, grassRoadS,
              grassRoadEW, grassRoadW, grassRoadE,
              grassRoadNW, grassRoadNE, grassRoadSE, grassRoadSW,
              grassRoadNEWS ]
let model :GridTileSceneModel = generateGridModel(tiles, 12, 12, gridConfig)
app.setMode(new GridTileSceneViewMode(app, model))
