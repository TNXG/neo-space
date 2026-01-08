'use client';

import { useEffect } from 'react';
import { usePageContext } from '@/contexts/PageContext';

interface PageInfoSetterProps {
  pageType: 'post' | 'note' | 'page';
  pageId: string;
  pageTitle?: string;
}

/**
 * 页面信息设置器
 * 在文章/笔记页面中使用，自动设置当前页面信息
 */
export function PageInfoSetter({ pageType, pageId, pageTitle }: PageInfoSetterProps) {
  const { setPageInfo } = usePageContext();

  useEffect(() => {
    setPageInfo({ pageType, pageId, pageTitle });
    
    return () => {
      setPageInfo(null);
    };
  }, [pageType, pageId, pageTitle, setPageInfo]);

  return null;
}
