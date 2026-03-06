export const firebaseConfig = {
  // Firebase 專案設定（Web App）
  apiKey: "AIzaSyBH_aPyF72Y-kGFWvh-713EcB01zQl9FVQ",
  authDomain: "testsystem-be3f2.firebaseapp.com",
  projectId: "testsystem-be3f2",
  databaseURL: "https://testsystem-be3f2-default-rtdb.firebaseio.com",
  storageBucket: "testsystem-be3f2.firebasestorage.app",
  messagingSenderId: "465873295437",
  appId: "1:465873295437:web:e8d99ebc1437cea0a4e404",
};

export function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.databaseURL
  );
}
