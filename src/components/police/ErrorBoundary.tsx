import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('ErrorBoundary caught:', error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center h-full p-6 text-center">
            <div>
              <p className="text-sm text-slate-400 mb-1">이 영역을 불러오는 중 문제가 발생했습니다.</p>
              <p className="text-xs text-slate-600">다른 신고를 선택하면 다시 표시됩니다.</p>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
