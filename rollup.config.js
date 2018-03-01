import babel from "rollup-plugin-babel"
import uglify from "rollup-plugin-uglify"
import filesize from "rollup-plugin-filesize"

import pkg from "./package.json"

export default [
  {
    input: "./src/index.js",
    output: {
      file: pkg.main,
      format: "umd",
      name: "mpts"
    },
    plugins: [
      babel({
        exclude: "node_modules/**"
      }),
      uglify(),
      filesize()
    ]
  }
]
