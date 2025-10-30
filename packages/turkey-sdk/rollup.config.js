import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import dts from 'rollup-plugin-dts'

export default [
  // Main ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
    external: ['jose', 'js-cookie', 'react', 'react/jsx-runtime'],
  },
  // Main CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
    external: ['jose', 'js-cookie', 'react', 'react/jsx-runtime'],
  },
  // Main type declarations (bundled)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
    external: ['jose', 'js-cookie', 'react', 'react/jsx-runtime'],
  },
  // Middleware ESM build
  {
    input: 'src/middleware/index.ts',
    output: {
      file: 'dist/middleware/index.esm.js',
      format: 'es',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
    external: ['jose', 'js-cookie', 'react', 'react/jsx-runtime'],
  },
  // Middleware CommonJS build
  {
    input: 'src/middleware/index.ts',
    output: {
      file: 'dist/middleware/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
    external: ['jose', 'js-cookie', 'react', 'react/jsx-runtime'],
  },
  // Middleware type declarations (bundled)
  {
    input: 'src/middleware/index.ts',
    output: {
      file: 'dist/middleware/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
    external: ['jose', 'js-cookie', 'react', 'react/jsx-runtime'],
  },
]
