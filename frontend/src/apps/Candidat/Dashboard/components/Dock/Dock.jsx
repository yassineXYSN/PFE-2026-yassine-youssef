import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import "./Dock.css";

const Dock = ({
    items,
    baseWidth = 140,
    baseHeight = 48,
    magnification = 1.1, // Scale factor
    distance = 140,
    panelHeight = 64,
    className = ""
}) => {
    const mouseX = useMotionValue(Infinity);

    return (
        <motion.div
            onMouseMove={(e) => mouseX.set(e.pageX)}
            onMouseLeave={() => mouseX.set(Infinity)}
            className={`dock-panel ${className}`}
            style={{ height: panelHeight }}
        >
            {items.map((item, index) => (
                <DockItem
                    key={index}
                    mouseX={mouseX}
                    baseWidth={baseWidth}
                    baseHeight={baseHeight}
                    magnification={magnification}
                    distance={distance}
                    item={item}
                />
            ))}
        </motion.div>
    );
};

const DockItem = ({ mouseX, baseWidth, baseHeight, magnification, distance, item }) => {
    const ref = useRef(null);

    const distanceCalc = useTransform(mouseX, (val) => {
        const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
        return val - bounds.x - bounds.width / 2;
    });

    const widthSync = useTransform(
        distanceCalc,
        [-distance, 0, distance],
        [baseWidth, baseWidth * magnification, baseWidth]
    );

    const heightSync = useTransform(
        distanceCalc,
        [-distance, 0, distance],
        [baseHeight, baseHeight * magnification, baseHeight]
    );

    const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });
    const height = useSpring(heightSync, { mass: 0.1, stiffness: 150, damping: 12 });

    return (
        <motion.div
            ref={ref}
            style={{ width, height }}
            onClick={item.onClick}
            className={`dock-item ${item.isActive ? 'active' : ''}`}
        >
            <div className="dock-content">
                <span className="dock-icon">{item.icon}</span>
                <span className="dock-label">{item.label}</span>
            </div>
            {item.isActive && (
                <motion.div
                    layoutId="activeGlow"
                    className="dock-active-glow"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}
        </motion.div>
    );
};

export default Dock;
