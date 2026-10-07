import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { EncodingType, getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { CloudImage } from './api/types';
import { client } from './api/client';
import { t } from '@/text';

const MAX_IMAGE_BYTES = 700 * 1024;
const MAX_IMAGES = 4;

export async function base64FromUri(uri: string): Promise<string> {
    if (Platform.OS !== 'web') {
        return readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    }
    const blob = await (await fetch(uri)).blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(t('kissopen.conversation.imageReadFailed')));
        reader.onload = () => {
            const value = String(reader.result || '');
            resolve(value.slice(value.indexOf(',') + 1));
        };
        reader.readAsDataURL(blob);
    });
}

async function normalize(asset: ImagePicker.ImagePickerAsset) {
    const longEdge = Math.max(asset.width, asset.height);
    const resize = longEdge > 1440
        ? asset.width >= asset.height ? { width: 1440 } : { height: 1440 }
        : undefined;
    let image = await manipulateAsync(asset.uri, resize ? [{ resize }] : [], {
        compress: 0.72,
        format: SaveFormat.JPEG,
    });
    let info = await getInfoAsync(image.uri);
    if (info.exists && !info.isDirectory && info.size > MAX_IMAGE_BYTES) {
        const retryResize = image.width >= image.height ? { width: 1024 } : { height: 1024 };
        image = await manipulateAsync(image.uri, [{ resize: retryResize }], {
            compress: 0.55,
            format: SaveFormat.JPEG,
        });
        info = await getInfoAsync(image.uri);
    }
    if (!info.exists || info.isDirectory || info.size <= 0 || info.size > MAX_IMAGE_BYTES) {
        throw new Error(t('kissopen.conversation.imageTooLarge'));
    }
    return { ...image, size: info.size };
}

async function uploadAsset(asset: ImagePicker.ImagePickerAsset): Promise<CloudImage> {
    const image = await normalize(asset);
    const data = await base64FromUri(image.uri);
    const uploaded = await client.uploadImage(
        asset.fileName ? `${asset.fileName.replace(/\.[^.]+$/, '')}.jpg` : `image-${Date.now()}.jpg`,
        'image/jpeg',
        data,
        image.width,
        image.height,
    );
    return { ...uploaded, uri: image.uri, size: image.size, width: image.width, height: image.height, mimeType: 'image/jpeg' };
}

export async function pickCloudImages(source: 'camera' | 'library', remaining: number): Promise<CloudImage[]> {
    const limit = Math.min(Math.max(remaining, 0), MAX_IMAGES);
    if (!limit) throw new Error(t('kissopen.conversation.imageLimit', { max: MAX_IMAGES }));
    if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error(t('kissopen.conversation.cameraPermission'));
    }
    const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: limit, quality: 1, exif: false });
    if (result.canceled) return [];
    const images: CloudImage[] = [];
    for (const asset of result.assets.slice(0, limit)) images.push(await uploadAsset(asset));
    return images;
}
