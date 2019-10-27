const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
// https://babeljs.io/docs/en/babel-parser
// 用来分析代码--可以返回，抽象语法树ast
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babelCore = require('@babel/core')

/**
 * 分析文件
 * @param {String} filename 文件路径
 */
const moduleAnalyser = filename => {
  const fileSource = fs.readFileSync(filename, 'utf-8')

  // 获取文件的抽象语法树--将js的代码文件内容，转化为js的对象
  const ast = parser.parse(fileSource, {
    sourceType: 'module'
  })

  // console.log(ast.program.body)
  // 入口文件，有几个依赖的文件
  const dependencies = {}
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(filename)
      const key = node.source.value
      const pathValue = './' + path.join(dirname, node.source.value)
      // console.log(node)
      dependencies[key] = pathValue
    }
  })

  // console.log(dependencies)

  // 转化为浏览器可以执行的代码
  const { code } = babelCore.transformFromAst(ast, null, {
    presets: ['@babel/preset-env']
  })

  // console.log(code)

  return {
    filename,
    dependencies,
    code
  }
}

// // 对入口文件的分析结果
// const moduleInfo = moduleAnalyser('./src/index.js')

// 生成一个依赖图谱，来存放所有模块的依赖信息
// 通过队列的方式，来实现，类似递归的效果
const makeDependenciesGraph = entryFile => {
  const entryModule = moduleAnalyser(entryFile)
  const graphArray = [entryModule]

  for (let i = 0; i < graphArray.length; i++) {
    const item = graphArray[i]
    const { dependencies } = item

    if (Object.keys(dependencies).length) {
      for (const key in dependencies) {
        graphArray.push(moduleAnalyser(dependencies[key]))
      }
    }
  }

  const graphObj = {}

  graphArray.forEach(item => {
    const { code, dependencies } = item
    graphObj[item.filename] = {
      code,
      dependencies
    }
  })

  return graphObj
}

// 或者使用递归--没写对，不知道什么原因
// const makeDependenciesGraph = entryFile => {
//   const graphArray = []
//   const make = file => {
//     const item = moduleAnalyser(entryFile)
//     if (Object.keys(item.dependencies).length) {
//       for (const key in item.dependencies) {
//         make(item.dependencies[key])
//       }
//     } else {
//       graphArray.push(item)
//     }
//   }
//   make(entryFile)

//   return graphArray
// }

// 依赖图谱--整个工程项目的，依赖树
// const graphInfo = makeDependenciesGraph('./src/index.js')
// console.log(graphInfo)

/**
 * 根据上述的graphInfo（依赖图谱），来拼接，生成，最终可以在浏览器运行的代码
 * @param {String} entryFile 这是一个函数
 */
const generateCode = entryFile => {
  const graphInfo = JSON.stringify(makeDependenciesGraph(entryFile))

  return `
    (function (graphInfo) {
      function require(module) {

        function localRequire(relativePath) {
          return require(graphInfo[module].dependencies[relativePath]);
        }

        var exports = {};

        (function (require, exports, code) {
          eval(code)
        })(localRequire, exports, graphInfo[module].code);

        return exports;
      };

      require('${entryFile}');
    })(${graphInfo})
  `
}

console.log(generateCode('./src/index.js'))
