# Awareness Network 2.0 Mobile App

React Native移动端应用，提供完整的知识管理功能。

## 功能特性

### 核心功能
- 📸 **摄像头拍照**：实时拍摄文档、名片、会展资料
- 🖼️ **图片上传**：从相册选择图片上传
- 🤖 **AI识别**：自动OCR识别和文档生成
- 📚 **知识库**：浏览、搜索和管理知识文档
- 👥 **联系人**：管理从名片提取的联系信息
- 🏷️ **标签系统**：智能分类和组织

### 高级功能
- 💳 **订阅管理**：15天免费试用 + 付费订阅
- 🔐 **多登录方式**：
  - Manus OAuth（默认）
  - Web3钱包（MetaMask）
  - 邮箱验证码
  - 社交登录（Google）
- 💰 **灵活支付**：
  - Stripe信用卡支付
  - USDT加密货币支付
- ☁️ **分布式存储**：
  - S3存储（所有用户）
  - IPFS存储（付费用户）

## 技术栈

- **框架**：React Native 0.73
- **导航**：React Navigation 6
- **状态管理**：TanStack Query + tRPC
- **相机**：react-native-vision-camera
- **Web3**：ethers.js + WalletConnect
- **存储**：AsyncStorage + Keychain

## 开发环境要求

### 通用要求
- Node.js 18+
- npm或yarn
- React Native CLI

### Android开发
- Android Studio
- Android SDK (API 33+)
- Java JDK 17

### iOS开发
- macOS
- Xcode 15+
- CocoaPods

## 安装依赖

```bash
# 安装npm依赖
npm install

# iOS额外步骤
cd ios && pod install && cd ..
```

## 运行应用

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

## 构建发布版本

### Android APK
```bash
npm run build:android
# 输出：android/app/build/outputs/apk/release/app-release.apk
```

### iOS IPA
```bash
npm run build:ios
# 需要在Xcode中配置签名证书
```

## 项目结构

```
mobile-app/
├── src/
│   ├── screens/          # 页面组件
│   │   ├── HomeScreen.tsx
│   │   ├── CameraScreen.tsx
│   │   ├── DocumentsScreen.tsx
│   │   ├── ContactsScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── components/       # 可复用组件
│   │   ├── DocumentCard.tsx
│   │   ├── ContactCard.tsx
│   │   └── CameraPreview.tsx
│   ├── navigation/       # 导航配置
│   │   └── AppNavigator.tsx
│   ├── services/         # API服务
│   │   ├── trpc.ts
│   │   ├── camera.ts
│   │   └── storage.ts
│   ├── utils/           # 工具函数
│   │   ├── auth.ts
│   │   └── format.ts
│   └── assets/          # 静态资源
├── android/             # Android原生代码
├── ios/                 # iOS原生代码
└── package.json
```

## 配置

### API端点
在`src/services/trpc.ts`中配置后端API地址：

```typescript
const API_URL = 'https://your-api-domain.com/api/trpc';
```

### 相机权限

#### Android (`android/app/src/main/AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

#### iOS (`ios/AwarenessNetwork/Info.plist`)
```xml
<key>NSCameraUsageDescription</key>
<string>需要访问相机以拍摄文档和名片</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>需要访问相册以选择图片</string>
```

## 发布到应用商店

### Google Play
1. 在`android/app/build.gradle`中配置签名
2. 运行`npm run build:android`
3. 上传APK到Google Play Console

### App Store
1. 在Xcode中配置Bundle ID和签名
2. Archive构建
3. 上传到App Store Connect

## 开发者账号

- **Apple Developer**: everest9812@gmail.com
- **Google Play**: everest9812@gmail.com

## 故障排除

### Android构建失败
```bash
cd android && ./gradlew clean && cd ..
npm run android
```

### iOS Pod安装失败
```bash
cd ios && pod deintegrate && pod install && cd ..
```

### Metro Bundler缓存问题
```bash
npm start -- --reset-cache
```

## 许可证

MIT License

---

**Awareness Network 2.0 Mobile** - 让知识管理更智能
