import React from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

export type SectionKey = 'home' | 'settings' | 'notifications' | 'profile';

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (value: boolean) => void;
  activeSection: SectionKey;
  onSectionChange: (section: SectionKey) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onCollapse,
  activeSection,
  onSectionChange,
}) => {
  // Define menu items in the visual order we want
  const menuItems = [
    { key: 'home', icon: <HomeOutlined />, label: 'Home' },
    { key: 'notifications', icon: <BellOutlined />, label: 'Notifications' },
    { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  // Top: Home, Notifications
  const topItems = menuItems.filter((i) => ['home', 'notifications','profile', 'settings'].includes(i.key));
 

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="lg"
      style={{
        background: 'linear-gradient(180deg, #4f73ff 0%, #79acff 100%)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        <div>
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: collapsed ? 18 : 20,
              letterSpacing: 0.5,
            }}
          >
            {collapsed ? 'DE' : 'DormEase'}
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => onSectionChange(key as SectionKey)}
            style={{ background: 'transparent', border: 'none' }}
            items={topItems}
          />
        </div>

        <div style={{ padding: '12px 0' }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => onSectionChange(key as SectionKey)}
            style={{ background: 'transparent', border: 'none' }}
          />
        </div>
      </div>
    </Sider>
  );
};

export default Sidebar;

