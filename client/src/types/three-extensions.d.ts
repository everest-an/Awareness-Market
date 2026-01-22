declare module "three/examples/jsm/controls/OrbitControls" {
	export class OrbitControls {
		constructor(object: unknown, domElement?: HTMLElement);
		enabled: boolean;
		enableDamping: boolean;
		autoRotate: boolean;
		autoRotateSpeed: number;
		update(): void;
		dispose(): void;
	}
}
