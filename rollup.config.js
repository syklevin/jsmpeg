import babel from "rollup-plugin-babel"
import uglify from "rollup-plugin-uglify"
import filesize from "rollup-plugin-filesize"

import pkg from "./package.json"

const input = "./src/index.js"

const babelPlugin = babel({
  exclude: "node_modules/**"
})


export default [
  {
    input: input,
    external: [],
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" }
    ],
    plugins: [
      babelPlugin,
      filesize()
    ]
  },
  {
    input: input,
    output: {
      file: pkg.browser,
      format: "umd",
      name: "mpts"
    },
    plugins: [
      babelPlugin,
      uglify(),
      filesize()
    ]
  }
]
