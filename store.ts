import { combineReducers, configureStore } from "@reduxjs/toolkit"
import { useDispatch, useSelector } from "react-redux"
import type { TypedUseSelectorHook } from "react-redux"
import { syncStorage } from "redux-persist-webextension-storage"
import { Storage } from "@plasmohq/storage"

import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
  RESYNC
} from "@plasmohq/redux-persist"
import feedbackSlice from "./feedbackSlice"  // измените путь к вашему feedbackSlice, если необходимо

const combinedReducers = combineReducers({
  feedback: feedbackSlice
})

const persistConfig = {
  key: "root",
  version: 1,
  storage: syncStorage
}

const persistedReducer = persistReducer(persistConfig, combinedReducers)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          FLUSH,
          REHYDRATE,
          PAUSE,
          PERSIST,
          PURGE,
          REGISTER,
          RESYNC
        ]
      }
    })
})

export const persistor = persistStore(store)

new Storage().watch({
  [`persist:${persistConfig.key}`]: () => {
    persistor.resync()
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
