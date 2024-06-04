import { useEffect, useState } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { Provider } from "react-redux"
import { PersistGate } from "@plasmohq/redux-persist/integration/react"
import { persistor, store } from "./store"
import { setTimer } from "./feedbackSlice"
import type { RootState } from './store';

const RenderItem = ({ review, replyText, setReplyText }) => {
  return (
    <div key={review.uuid} style={{ border: "1px solid black", padding: "10px", margin: "10px" }}>
      <p>Product : {review.product.title}</p>
      <p>ProductId : {review.product.offer_id}</p>
      <p>UUID: {review.uuid}</p>
      <p>Rating: {review.rating}</p>
      <p>Positive: {review.text.positive}</p>
      <p>Negative: {review.text.negative}</p>
      <p>Comment: {review.text.comment}</p>
      <textarea
        value={replyText[review.uuid] || ""}
        onChange={(e) => setReplyText({ ...replyText, [review.uuid]: e.target.value })}
      />
      {/* <button onClick={() => ansverRiviev(review.uuid, replyText[review.uuid] || "")}>Ответить</button> */}
    </div>
  )
}

const Popup = () => {
  const timer = useSelector((state: RootState) => state.feedback.timer);
  const data = useSelector((state: RootState) => state.feedback.feedback);

  const [url, setUrl] = useState("");

  useEffect(() => {
    const queryInfo = { active: true, currentWindow: true };
    chrome.tabs.query(queryInfo, (tabs) => {
      const tab = tabs[0];
      setUrl(tab.url);
    });
  }, []);


  const handleRedirect = () => {
    chrome.tabs.create({ url: "https://seller.ozon.ru/app" });
  };

  if (url.includes("https://seller.ozon.ru/app")) {
    return (
      <div>
        <p>Следующее обновление через -  {timer} секунд</p>
        <p>Необработано отзывов -  {data.length}</p>
      </div>
    );
  }

  return (
    <div>
      <p>Данный плагин работает только на <span onClick={handleRedirect} style={{ color: 'blue', cursor: 'pointer' }}>этой странице</span>.</p>
    </div>
  );
};

function IndexPopup() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Popup />
      </PersistGate>
    </Provider>
  )
}

export default IndexPopup
