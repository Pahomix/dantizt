import { createContext, useContext } from 'react';
import AuthStore from './authStore';
import DoctorStore from './doctorStore';
import PatientStore from './patientStore';

class RootStore {
  constructor() {
    this.authStore = new AuthStore(this);
    this.doctorStore = new DoctorStore(this);
    this.patientStore = new PatientStore(this);
  }
}

const StoreContext = createContext(null);

export const StoreProvider = ({ children }) => {
  const store = new RootStore();
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return store;
};
