interface Window {
  WebBiometrics?: {
    getDiagnostics?: () => Promise<any>;
    enroll: (...args: any[]) => Promise<any>;
    authenticate: (...args: any[]) => Promise<any>;
  };
  DashboardUtils?: {
    debounce?: (...args: any[]) => any;
    getCategoryColor?: (...args: any[]) => any;
    getCategoryEmoji?: (...args: any[]) => any;
    [key: string]: any;
  };
  DashboardFilters?: {
    createController?: (...args: any[]) => any;
    [key: string]: any;
  };
  DashboardPowerBI?: {
    applyCrossFilter: (type: string, value: string | number | boolean, label: string) => void;
    [key: string]: any;
  };
  openNewIncomeModal?: (...args: any[]) => any;
}
