import { useRef } from 'react';
import { Button } from './button';
import { Upload } from 'lucide-react';

interface ImageUploadProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFileSelect?: (file: File, previewUrl: string) => void;
}

export const ImageUpload = ({ label, value, onChange, onFileSelect }: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      onFileSelect?.(file, previewUrl);
      onChange?.(previewUrl);
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      {label && <label className="text-[10px] font-semibold uppercase text-gray-500">{label}</label>}
      <div className="flex items-center gap-3">
        {value ? (
            <img src={value} alt="Preview" className="h-8 w-8 object-cover rounded border border-gray-200 bg-gray-50" />
        ) : (
            <div className="h-8 w-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-[10px]">
                IMG
            </div>
        )}
        <input
            type="file"
            ref={inputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
        />
        <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => inputRef.current?.click()}
        >
            <Upload className="mr-2 h-3 w-3" />
            {value ? 'Change Image' : 'Browse Image'}
        </Button>
      </div>
    </div>
  );
};
