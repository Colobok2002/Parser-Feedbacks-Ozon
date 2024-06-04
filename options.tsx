import { Provider } from "react-redux"

import { PersistGate } from "@plasmohq/redux-persist/integration/react"

import { store } from "~store"

function Options() {
  return (
    <Provider store={store}>
      <>
      </>
    </Provider>
  )
}

export default Options