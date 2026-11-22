import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Mail, Send, Globe, Code2 } from 'lucide-react';

interface FooterProps {
  onOpenDeveloperProfile: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenDeveloperProfile }) => {
  const [creditText, setCreditText] = useState('Developed & Maintained by DEV ARJUN');
  const [developerName, setDeveloperName] = useState('DEV ARJUN');

  useEffect(() => {
    let isMounted = true;
    apiRequest('/api/v1/developer-profile', {}, 'none')
      .then((res) => {
        if (isMounted && res.success && res.data) {
          if (res.data.footerCreditText) setCreditText(res.data.footerCreditText);
          if (res.data.name) setDeveloperName(res.data.name);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <footer className="bg-[#06040A] border-t-2 border-[#1F1930] px-6 py-4 font-mono select-none text-[11px] text-[#A39BAD] shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Product Platform Identity */}
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="w-1.5 h-1.5 bg-[#A020F0]" />
          <span className="text-white font-bold tracking-wider uppercase">
            KARVION API MANAGER
          </span>
          <span className="text-[#6D657A] hidden md:inline">// ENTERPRISE GATEWAY</span>
        </div>

        {/* Center: Interactive Developer Credit */}
        <div className="flex items-center gap-1.5 text-center">
          <Code2 className="w-3.5 h-3.5 text-[#A020F0] shrink-0" />
          <span>Developed &amp; Maintained by</span>
          <button
            type="button"
            onClick={onOpenDeveloperProfile}
            className="text-white hover:text-[#C77DFF] font-bold underline transition-colors cursor-pointer ml-0.5 tracking-wider uppercase"
            title="Click to view Developer Profile & Contact Details"
          >
            {developerName}
          </button>
        </div>

        {/* Right: Direct Quick Contact Badges */}
        <div className="flex items-center gap-4 text-[10px]">
          <button
            type="button"
            onClick={onOpenDeveloperProfile}
            className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
            title="Email Developer"
          >
            <Mail className="w-3 h-3 text-[#A020F0]" />
            <span className="hidden lg:inline">kahararjun537@gmail.com</span>
            <span className="lg:hidden">Email</span>
          </button>

          <a
            href="https://t.me/ArjunXploit"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1"
            title="Telegram: @ArjunXploit"
          >
            <Send className="w-3 h-3 text-[#38BDF8]" />
            <span>@ArjunXploit</span>
          </a>

          <a
            href="https://www.arjunkaharofficial.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1"
            title="Official Portfolio"
          >
            <Globe className="w-3 h-3 text-[#10B981]" />
            <span className="hidden sm:inline">Portfolio</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
