import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../../../core/cropImage';
import { useLanguage } from '../../../core/useLanguage';
import './ImageCropperModal.css';

const ImageCropperModal = ({ image, onCropComplete, onCancel }) => {
    const { t } = useLanguage();
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = useCallback((crop) => {
        setCrop(crop);
    }, []);

    const onZoomChange = useCallback((zoom) => {
        setZoom(zoom);
    }, []);

    const onCropCompleteInternal = useCallback((_croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        setIsProcessing(true);
        try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels);
            onCropComplete(croppedImage);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="cropper-modal-overlay">
            <div className="cropper-modal-container">
                <div className="cropper-modal-header">
                    <h2>{t('hr-modal-cropper-title')}</h2>
                    <button className="cropper-close-btn" onClick={onCancel}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="cropper-container">
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        aspect={1 / 1} // Logos are usually square
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteInternal}
                        onZoomChange={onZoomChange}
                    />
                </div>

                <div className="cropper-modal-footer">
                    <div className="cropper-controls">
                        <span className="material-symbols-outlined">zoom_in</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => onZoomChange(e.target.value)}
                            className="cropper-slider"
                        />
                    </div>

                    <div className="cropper-actions">
                        <button className="btn-cropper-cancel" onClick={onCancel}>
                            {t('hr-modal-cropper-cancel')}
                        </button>
                        <button
                            className="btn-cropper-save"
                            onClick={handleSave}
                            disabled={isProcessing}
                        >
                            {isProcessing ? t('hr-modal-cropper-processing') : t('hr-modal-cropper-save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageCropperModal;
